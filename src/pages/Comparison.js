import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import Header from "../components/Header";
import Page from "../components/Page";
import Footer from "../components/Footer";
import SelectWindow from "../components/SelectWindow";
import Warnings from "../components/Warnings";
import ComparisonTable from "../components/comparison/ComparisonTable";
import ComparisonChart from "../components/comparison/ComparisonChart";
import AllocationService from "../services/allocation";
import { rangeToCumulative } from "../util";

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
  { name: "Deployment", value: "deployment" },
  { name: "Service", value: "service" },
  { name: "Pod", value: "pod" },
  { name: "Node", value: "node" },
];

// Compute the prior period window as ISO dates given a window string
function computePriorWindow(win) {
  const now = new Date();
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);

  const fmt = (d) => d.toISOString().split(".")[0] + "Z";

  const dayMs = 86400000;

  switch (win) {
    case "today": {
      const start = new Date(today.getTime() - dayMs);
      return `${fmt(start)},${fmt(today)}`;
    }
    case "yesterday": {
      const end = new Date(today.getTime() - dayMs);
      const start = new Date(end.getTime() - dayMs);
      return `${fmt(start)},${fmt(end)}`;
    }
    case "24h": {
      const end = new Date(now.getTime() - dayMs);
      const start = new Date(end.getTime() - dayMs);
      return `${fmt(start)},${fmt(end)}`;
    }
    case "48h": {
      const end = new Date(now.getTime() - 2 * dayMs);
      const start = new Date(end.getTime() - 2 * dayMs);
      return `${fmt(start)},${fmt(end)}`;
    }
    case "week": {
      // Week-to-date: prior period is same duration ending at start of this week
      const dayOfWeek = now.getUTCDay();
      const weekStart = new Date(today.getTime() - dayOfWeek * dayMs);
      const duration = now.getTime() - weekStart.getTime();
      const priorEnd = weekStart;
      const priorStart = new Date(priorEnd.getTime() - duration);
      return `${fmt(priorStart)},${fmt(priorEnd)}`;
    }
    case "lastweek": {
      // Week before last
      const dayOfWeek = today.getUTCDay();
      const thisWeekStart = new Date(today.getTime() - dayOfWeek * dayMs);
      const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * dayMs);
      const priorEnd = lastWeekStart;
      const priorStart = new Date(priorEnd.getTime() - 7 * dayMs);
      return `${fmt(priorStart)},${fmt(priorEnd)}`;
    }
    case "7d": {
      const sevenDaysAgo = new Date(now.getTime() - 7 * dayMs);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * dayMs);
      return `${fmt(fourteenDaysAgo)},${fmt(sevenDaysAgo)}`;
    }
    case "14d": {
      const fourteenDaysAgo = new Date(now.getTime() - 14 * dayMs);
      const twentyEightDaysAgo = new Date(now.getTime() - 28 * dayMs);
      return `${fmt(twentyEightDaysAgo)},${fmt(fourteenDaysAgo)}`;
    }
    default: {
      // For custom ISO windows, shift back by the same duration
      const parts = win.split(",");
      if (parts.length === 2) {
        const start = new Date(parts[0]);
        const end = new Date(parts[1]);
        const duration = end.getTime() - start.getTime();
        const priorEnd = start;
        const priorStart = new Date(priorEnd.getTime() - duration);
        return `${fmt(priorStart)},${fmt(priorEnd)}`;
      }
      // Fallback: preceding 7 days
      const sevenDaysAgo = new Date(now.getTime() - 7 * dayMs);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * dayMs);
      return `${fmt(fourteenDaysAgo)},${fmt(sevenDaysAgo)}`;
    }
  }
}

const ComparisonPage = () => {
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [rows, setRows] = useState([]);

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

    const priorWindow = computePriorWindow(win);

    try {
      const [currentResp, priorResp] = await Promise.all([
        AllocationService.fetchAllocation(win, aggregateBy, {
          accumulate: true,
          includeIdle: false,
        }),
        AllocationService.fetchAllocation(priorWindow, aggregateBy, {
          accumulate: true,
          includeIdle: false,
        }).catch(() => null),
      ]);

      const currentCum = currentResp?.data?.length > 0
        ? rangeToCumulative(currentResp.data, aggregateBy)
        : {};

      const priorCum = priorResp?.data?.length > 0
        ? rangeToCumulative(priorResp.data, aggregateBy)
        : {};

      // Merge into comparison rows
      const allNames = new Set([
        ...Object.keys(currentCum || {}),
        ...Object.keys(priorCum || {}),
      ]);

      const merged = [];
      allNames.forEach((name) => {
        if (name === "__idle__" || name === "__unallocated__") return;
        const current = currentCum?.[name]?.totalCost || 0;
        const prior = priorCum?.[name]?.totalCost || 0;
        const change = current - prior;
        const changePct = prior !== 0 ? (change / prior) * 100 : 0;
        merged.push({
          name,
          currentCost: current,
          priorCost: prior,
          change,
          changePct,
        });
      });

      setRows(merged);
    } catch (err) {
      let secondary = "Please open an Issue on GitHub if problems persist.";
      if (err.message && err.message.length > 0) {
        secondary = err.message;
      }
      setErrors([{ primary: "Failed to load comparison data", secondary }]);
      setRows([]);
    }

    setLoading(false);
  }

  return (
    <Page>
      <Header headerTitle="Compare Periods">
        <IconButton aria-label="refresh" onClick={() => fetchData()} style={{ padding: 12 }}>
          <RefreshIcon />
        </IconButton>
      </Header>

      {!loading && errors.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <Warnings warnings={errors} />
        </div>
      )}

      <Paper>
        <div style={{ display: "flex", flexFlow: "row", padding: 24, alignItems: "center", gap: 16 }}>
          <div style={{ flexGrow: 1 }}>
            <Typography variant="h5">Period-over-Period Comparison</Typography>
            <Typography variant="body2" style={{ color: "#666", marginTop: 4 }}>
              Current period vs. previous equivalent period
            </Typography>
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
        {!loading && (
          <>
            <ComparisonChart rows={rows} />
            <ComparisonTable rows={rows} />
          </>
        )}
      </Paper>
      <Footer />
    </Page>
  );
};

export default React.memo(ComparisonPage);
