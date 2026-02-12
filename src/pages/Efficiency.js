import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import EfficiencyReport from "../components/EfficiencyReport";
import Header from "../components/Header";
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

const EfficiencySummaryCards = ({ data }) => {
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
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);

  const routerLocation = useLocation();
  const searchParams = new URLSearchParams(routerLocation.search);
  const navigate = useNavigate();

  const win = searchParams.get("window") || "7d";
  const aggregateBy = searchParams.get("agg") || "namespace";

  useEffect(() => {
    fetchData();
  }, [win, aggregateBy]);

  async function fetchData() {
    setLoading(true);
    setErrors([]);

    try {
      const resp = await EfficiencyService.fetchEfficiency(win, aggregateBy);
      if (resp.data && resp.data.efficiencies) {
        setEfficiencyData(resp.data.efficiencies);
      } else {
        setEfficiencyData([]);
      }
    } catch (err) {
      let secondary = "Please open an Issue on GitHub if problems persist.";
      if (err.message && err.message.length > 0) {
        secondary = err.message;
      }
      setErrors([
        {
          primary: "Failed to load efficiency data",
          secondary,
        },
      ]);
      setEfficiencyData([]);
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
        <EfficiencySummaryCards data={efficiencyData} />
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
        </div>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ paddingTop: 100, paddingBottom: 100 }}>
              <CircularProgress />
            </div>
          </div>
        )}
        {!loading && <EfficiencyReport data={efficiencyData} />}
      </Paper>
      <Footer />
    </Page>
  );
};

export default React.memo(EfficiencyPage);
