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
