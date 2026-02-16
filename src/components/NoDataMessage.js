import React, { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Link from "@mui/material/Link";
import client from "../services/api_client";

const shorterWindows = [
  { label: "Today", value: "today" },
  { label: "Last 24h", value: "24h" },
  { label: "Last 48h", value: "48h" },
];

// Windows that span multiple days — these are the ones likely to fail on young clusters
const longWindows = new Set(["7d", "14d", "week", "lastweek"]);

const NoDataMessage = ({ window: win, onWindowChange }) => {
  const [status, setStatus] = useState("checking"); // checking | healthy | unreachable
  const [clusterInfo, setClusterInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    client
      .get("/installInfo")
      .then((resp) => {
        if (cancelled) return;
        const info = resp.data?.clusterInfo;
        setClusterInfo(info || null);
        setStatus("healthy");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("unreachable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestShorter = longWindows.has(win);
  const nodeCount = parseInt(clusterInfo?.nodeCount, 10) || 0;

  if (status === "checking") {
    return (
      <Alert severity="info" style={{ margin: "16px 24px" }}>
        Checking cluster status...
      </Alert>
    );
  }

  if (status === "unreachable") {
    return (
      <Alert severity="error" style={{ margin: "16px 24px" }}>
        Unable to reach the OpenCost backend. Check that your OpenCost
        deployment is running and accessible.
      </Alert>
    );
  }

  // healthy backend, no data for this window
  return (
    <Alert severity="info" style={{ margin: "16px 24px" }}>
      No data available for the selected time window.
      {nodeCount > 0 && (
        <span>
          {" "}Your cluster is healthy ({nodeCount} node
          {nodeCount === 1 ? "" : "s"}) but may not have collected enough data
          yet.
        </span>
      )}
      {suggestShorter && onWindowChange && (
        <span>
          {" "}Try a shorter range:{" "}
          {shorterWindows.map((w, i) => (
            <span key={w.value}>
              {i > 0 && ", "}
              <Link
                component="button"
                variant="body2"
                onClick={() => onWindowChange(w.value)}
                style={{ verticalAlign: "baseline" }}
              >
                {w.label}
              </Link>
            </span>
          ))}
        </span>
      )}
    </Alert>
  );
};

export default NoDataMessage;
