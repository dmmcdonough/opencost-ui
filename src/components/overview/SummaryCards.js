import React from "react";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { toCurrency } from "../../util";

const cardStyle = {
  flex: "1 1 0",
  padding: 24,
  minWidth: 220,
};

const labelStyle = {
  fontSize: 13,
  color: "#666",
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginBottom: 8,
};

const valueStyle = {
  fontSize: 32,
  fontWeight: 600,
  lineHeight: 1.2,
};

const deltaStyle = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  marginTop: 6,
  fontSize: 14,
};

const DeltaIndicator = ({ current, prior }) => {
  if (prior === 0 && current === 0) {
    return (
      <div style={{ ...deltaStyle, color: "#666" }}>
        No change vs prior period
      </div>
    );
  }

  const diff = current - prior;
  const pct = prior !== 0 ? (diff / prior) * 100 : 0;
  const increased = diff > 0;
  // For costs, increase is red, decrease is green
  const color = increased ? "#f44336" : "#4caf50";

  return (
    <div style={{ ...deltaStyle, color }}>
      {increased ? (
        <ArrowUpwardIcon style={{ fontSize: 16 }} />
      ) : (
        <ArrowDownwardIcon style={{ fontSize: 16 }} />
      )}
      {toCurrency(Math.abs(diff))} ({Math.abs(pct).toFixed(1)}%) vs prior period
    </div>
  );
};

const effColor = (v) => {
  if (v >= 0.8) return "#4caf50";
  if (v >= 0.5) return "#ff9800";
  return "#f44336";
};

const SummaryCards = ({ totalSpend, priorSpend, efficiency, savings }) => {
  return (
    <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
      <Paper style={cardStyle}>
        <div style={labelStyle}>Total Spend (7d)</div>
        <div style={valueStyle}>{toCurrency(totalSpend)}</div>
        <DeltaIndicator current={totalSpend} prior={priorSpend} />
      </Paper>

      <Paper style={cardStyle}>
        <div style={labelStyle}>Cluster Efficiency</div>
        <div style={{ ...valueStyle, color: effColor(efficiency) }}>
          {(efficiency * 100).toFixed(1)}%
        </div>
        <div style={{ ...deltaStyle, color: "#666" }}>
          Cost-weighted avg of CPU &amp; memory
        </div>
      </Paper>

      <Paper style={cardStyle}>
        <div style={labelStyle}>Potential Savings</div>
        <div style={{ ...valueStyle, color: savings > 0 ? "#4caf50" : undefined }}>
          {toCurrency(savings)}
        </div>
        <div style={{ ...deltaStyle, color: "#666" }}>
          Per week from rightsizing
        </div>
      </Paper>
    </div>
  );
};

export default React.memo(SummaryCards);
