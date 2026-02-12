import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import { sortBy, toArray } from "lodash";
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import AllocationReport from "../components/allocationReport";
import Header from "../components/Header";
import Page from "../components/Page";
import Footer from "../components/Footer";
import SelectWindow from "../components/SelectWindow";
import Warnings from "../components/Warnings";
import AllocationService from "../services/allocation";
import {
  cumulativeToTotals,
  rangeToCumulative,
} from "../util";

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
  { name: "Team", value: "label:team" },
  { name: "Department", value: "label:department" },
  { name: "Owner", value: "label:owner" },
  { name: "Product", value: "label:app" },
];

import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";

const TeamsPage = () => {
  const [allocationData, setAllocationData] = useState([]);
  const [cumulativeData, setCumulativeData] = useState([]);
  const [totalData, setTotalData] = useState({});
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);

  const routerLocation = useLocation();
  const searchParams = new URLSearchParams(routerLocation.search);
  const navigate = useNavigate();

  const win = searchParams.get("window") || "7d";
  const aggregateBy = searchParams.get("agg") || "label:team";

  useEffect(() => {
    const cumulative = rangeToCumulative(allocationData, aggregateBy);
    setCumulativeData(toArray(cumulative));
    setTotalData(cumulativeToTotals(cumulative));
  }, [allocationData]);

  useEffect(() => {
    fetchData();
  }, [win, aggregateBy]);

  async function fetchData() {
    setLoading(true);
    setErrors([]);

    try {
      const resp = await AllocationService.fetchAllocation(win, aggregateBy, {
        accumulate: false,
        includeIdle: false,
      });
      if (resp.data && resp.data.length > 0) {
        const allocationRange = resp.data;
        for (const i in allocationRange) {
          allocationRange[i] = sortBy(allocationRange[i], (a) => a.totalCost);
        }
        setAllocationData(allocationRange);
      } else {
        setAllocationData([]);
      }
    } catch (err) {
      let secondary = "Please open an Issue on GitHub if problems persist.";
      if (err.message && err.message.length > 0) {
        secondary = err.message;
      }
      setErrors([{ primary: "Failed to load team data", secondary }]);
      setAllocationData([]);
    }

    setLoading(false);
  }

  function handleRowClick(row) {
    const label = aggregateBy.replace("label:", "");
    navigate(
      `/allocation?agg=namespace&filter=label:${label}:"${encodeURIComponent(row.name)}"`,
    );
  }

  return (
    <Page>
      <Header headerTitle="Teams">
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
            <Typography variant="h5">Team Costs</Typography>
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
            label="Group By"
            value={aggregateBy}
            onChange={(e) => {
              searchParams.set("agg", e.target.value);
              navigate({ search: `?${searchParams.toString()}` });
            }}
            variant="standard"
            style={{ minWidth: 140 }}
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
          <AllocationReport
            allocationData={allocationData}
            cumulativeData={cumulativeData}
            totalData={totalData}
            currency="USD"
            aggregateBy={aggregateBy}
            drilldown={handleRowClick}
          />
        )}
      </Paper>
      <Footer />
    </Page>
  );
};

export default React.memo(TeamsPage);
