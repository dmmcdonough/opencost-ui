import React from "react";
import Alert from "@mui/material/Alert";
import Link from "@mui/material/Link";

const shorterWindows = [
  { label: "Today", value: "today" },
  { label: "Last 24h", value: "24h" },
  { label: "Last 48h", value: "48h" },
];

// Windows that span multiple days — these are the ones likely to fail on young clusters
const longWindows = new Set(["7d", "14d", "week", "lastweek"]);

const NoDataMessage = ({ window: win, onWindowChange }) => {
  const suggestShorter = longWindows.has(win);

  return (
    <Alert severity="info" style={{ margin: "16px 24px" }}>
      No data available for the selected time window.
      {suggestShorter && onWindowChange && (
        <span>
          {" "}If your cluster is new, try a shorter range:{" "}
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
