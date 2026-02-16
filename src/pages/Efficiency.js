import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import EfficiencyReport from "../components/EfficiencyReport";
import Header from "../components/Header";
import NoDataMessage from "../components/NoDataMessage";
import Page from "../components/Page";
import Footer from "../components/Footer";
import SelectWindow from "../components/SelectWindow";
import Warnings from "../components/Warnings";
import EfficiencyService from "../services/efficiency";

const windowOptions = [
  { name: "Today", value: "today" },
  { name: "Yesterday", value: "yesterday" },
  { name: "Last 24h", value: "24h" },
  { name: "Last 48h", value: "48h" },
  { name: "Week-to-date", value: "week" },
  { name: "Last week", value: "lastweek" },
  { name: "Last 7 days", value: "7d" },
  { name: "Last 14 days", value: "14d" },
];

const summaryCardStyle = {
  flex: "1 1 0",
  padding: 24,
  minWidth: 200,
};

const summaryLabelStyle = {
  fontSize: 13,
  color: "#666",
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginBottom: 8,
};

const summaryValueStyle = {
  fontSize: 28,
  fontWeight: 600,
  lineHeight: 1.2,
};

const summaryEffColor = (v) => {
  if (v >= 0.8) return "#4caf50";
  if (v >= 0.5) return "#ff9800";
  return "#f44336";
};

const scaleDownCardStyle = (likely) => ({
  ...summaryCardStyle,
  backgroundColor: likely ? "#e8f5e9" : "#f5f5f5",
  border: likely ? "1px solid #a5d6a7" : "1px solid #e0e0e0",
});

const EfficiencySummaryCards = ({ data, clusterSavingsSummary }) => {
  let totalSavings = 0;
  let totalCpuCost = 0;
  let totalRamCost = 0;
  let weightedCpuEff = 0;
  let weightedRamEff = 0;
  let belowTarget = 0;

  data.forEach((item) => {
    totalSavings += item.costSavings || 0;
    const cpuCost = item.cpuCost || 0;
    const ramCost = item.ramCost || 0;
    totalCpuCost += cpuCost;
    totalRamCost += ramCost;
    weightedCpuEff += cpuCost * (item.cpuEfficiency || 0);
    weightedRamEff += ramCost * (item.memoryEfficiency || 0);

    const computeCost = cpuCost + ramCost;
    const eff =
      computeCost > 0
        ? (cpuCost * (item.cpuEfficiency || 0) + ramCost * (item.memoryEfficiency || 0)) /
          computeCost
        : 0;
    if (eff < 0.5) belowTarget++;
  });

  const totalComputeCost = totalCpuCost + totalRamCost;
  const clusterEff =
    totalComputeCost > 0
      ? (weightedCpuEff + weightedRamEff) / totalComputeCost
      : 0;

  return (
    <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
      <Paper style={summaryCardStyle}>
        <div style={summaryLabelStyle}>Total Potential Savings</div>
        <div style={{ ...summaryValueStyle, color: totalSavings > 0 ? "#4caf50" : undefined }}>
          ${totalSavings.toFixed(2)}
        </div>
      </Paper>
      <Paper style={summaryCardStyle}>
        <div style={summaryLabelStyle}>Cluster Efficiency</div>
        <div style={{ ...summaryValueStyle, color: summaryEffColor(clusterEff) }}>
          {(clusterEff * 100).toFixed(1)}%
        </div>
      </Paper>
      <Paper style={summaryCardStyle}>
        <div style={summaryLabelStyle}>Below 50% Efficiency</div>
        <div style={{ ...summaryValueStyle, color: belowTarget > 0 ? "#f44336" : "#4caf50" }}>
          {belowTarget} {belowTarget === 1 ? "item" : "items"}
        </div>
      </Paper>
      {clusterSavingsSummary && (
        <Paper style={scaleDownCardStyle(clusterSavingsSummary.scaleDownLikely)}>
          <div style={summaryLabelStyle}>Cluster Scale-Down</div>
          {clusterSavingsSummary.scaleDownLikely ? (
            <>
              <div style={{ ...summaryValueStyle, color: "#2e7d32", fontSize: 20 }}>
                {clusterSavingsSummary.nodeSavingsEstimateMsg || "Scale-down possible"}
              </div>
              <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>
                ~{clusterSavingsSummary.estimatedNodesFreed || 0} node
                {clusterSavingsSummary.estimatedNodesFreed === 1 ? "" : "s"} could be freed
                {clusterSavingsSummary.bottleneckResource && (
                  <span> (bottleneck: {clusterSavingsSummary.bottleneckResource})</span>
                )}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 14, color: "#888", marginTop: 4 }}>
              Freed resources don't fill a full node
            </div>
          )}
        </Paper>
      )}
    </div>
  );
};

const aggregationOptions = [
  { name: "Namespace", value: "namespace" },
  { name: "Controller", value: "controller" },
  { name: "Pod", value: "pod" },
  { name: "Deployment", value: "deployment" },
  { name: "StatefulSet", value: "statefulset" },
  { name: "DaemonSet", value: "daemonset" },
  { name: "Service", value: "service" },
];

const EfficiencyPage = () => {
  const [efficiencyData, setEfficiencyData] = useState([]);
  const [clusterSavingsSummary, setClusterSavingsSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);

  const routerLocation = useLocation();
  const searchParams = new URLSearchParams(routerLocation.search);
  const navigate = useNavigate();

  const win = searchParams.get("window") || "7d";
  const aggregateBy = searchParams.get("agg") || "namespace";
  const showSmall = searchParams.get("showSmall") === "true";
  const showSystem = searchParams.get("showSystem") === "true";

  useEffect(() => {
    fetchData();
  }, [win, aggregateBy, showSmall, showSystem]);

  async function fetchData() {
    setLoading(true);
    setErrors([]);

    try {
      const opts = {};
      if (showSmall) {
        opts.minSavings = 0;
        opts.minSavingsPercent = 0;
      }
      if (showSystem) {
        opts.excludeSystem = false;
      }
      const resp = await EfficiencyService.fetchEfficiency(win, aggregateBy, opts);
      if (resp.data && resp.data.efficiencies) {
        setEfficiencyData(resp.data.efficiencies);
      } else {
        setEfficiencyData([]);
      }
      setClusterSavingsSummary(resp.data?.clusterSavingsSummary || null);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || "";
      const isDataErr =
        /no data|no allocation|boundary|window/i.test(msg) ||
        err?.response?.status === 404;
      setErrors([
        {
          primary: isDataErr
            ? "No efficiency data available for this window"
            : "Failed to load efficiency data",
          secondary: isDataErr
            ? "Your cluster may not have enough historical data for this time range. Try a shorter window."
            : msg || "Please open an Issue on GitHub if problems persist.",
        },
      ]);
      setEfficiencyData([]);
      setClusterSavingsSummary(null);
    }

    setLoading(false);
  }

  return (
    <Page>
      <Header headerTitle="Efficiency">
        <IconButton aria-label="refresh" onClick={() => fetchData()} style={{ padding: 12 }}>
          <RefreshIcon />
        </IconButton>
      </Header>

      {!loading && errors.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <Warnings warnings={errors} />
        </div>
      )}

      {!loading && efficiencyData.length > 0 && (
        <EfficiencySummaryCards data={efficiencyData} clusterSavingsSummary={clusterSavingsSummary} />
      )}

      <Paper id="efficiency">
        <div style={{ display: "flex", flexFlow: "row", padding: 24, alignItems: "center", gap: 16 }}>
          <div style={{ flexGrow: 1 }}>
            <Typography variant="h5">Resource Efficiency</Typography>
          </div>

          <SelectWindow
            windowOptions={windowOptions}
            window={win}
            setWindow={(w) => {
              searchParams.set("window", w);
              navigate({ search: `?${searchParams.toString()}` });
            }}
          />

          <TextField
            select
            label="Aggregate By"
            value={aggregateBy}
            onChange={(e) => {
              searchParams.set("agg", e.target.value);
              navigate({ search: `?${searchParams.toString()}` });
            }}
            variant="standard"
            style={{ minWidth: 120 }}
          >
            {aggregationOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.name}
              </MenuItem>
            ))}
          </TextField>

          <FormControlLabel
            control={
              <Switch
                checked={showSmall}
                onChange={(e) => {
                  if (e.target.checked) {
                    searchParams.set("showSmall", "true");
                  } else {
                    searchParams.delete("showSmall");
                  }
                  navigate({ search: `?${searchParams.toString()}` });
                }}
                size="small"
              />
            }
            label="Show small savings"
            style={{ marginLeft: 8 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={showSystem}
                onChange={(e) => {
                  if (e.target.checked) {
                    searchParams.set("showSystem", "true");
                  } else {
                    searchParams.delete("showSystem");
                  }
                  navigate({ search: `?${searchParams.toString()}` });
                }}
                size="small"
              />
            }
            label="Include system namespaces"
            style={{ marginLeft: 8 }}
          />
        </div>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ paddingTop: 100, paddingBottom: 100 }}>
              <CircularProgress />
            </div>
          </div>
        )}
        {!loading && efficiencyData.length === 0 && errors.length === 0 && (
          <NoDataMessage
            window={win}
            onWindowChange={(w) => {
              searchParams.set("window", w);
              navigate({ search: `?${searchParams.toString()}` });
            }}
          />
        )}
        {!loading && efficiencyData.length > 0 && <EfficiencyReport data={efficiencyData} />}
      </Paper>
      <Footer />
    </Page>
  );
};

export default React.memo(EfficiencyPage);
