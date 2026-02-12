import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import Typography from "@mui/material/Typography";

const formatCurrency = (value) => `$${value.toFixed(0)}`;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: "1px solid #ccc",
        borderRadius: 4,
        padding: "8px 12px",
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} style={{ color: entry.color }}>
          {entry.name}: ${entry.value.toFixed(2)}
        </div>
      ))}
    </div>
  );
};

const ComparisonChart = ({ rows, n = 15, height = 350 }) => {
  if (!rows || rows.length === 0) {
    return null;
  }

  // Show top N by absolute change
  const sorted = [...rows]
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, n);

  const chartData = sorted.map((d) => ({
    name: d.name.length > 25 ? d.name.slice(0, 22) + "..." : d.name,
    "Current Period": d.currentCost,
    "Prior Period": d.priorCost,
  }));

  return (
    <div style={{ marginBottom: 16, padding: "0 16px" }}>
      <Typography variant="subtitle2" style={{ marginBottom: 8 }}>
        Top {Math.min(n, rows.length)} by Cost Change
      </Typography>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          margin={{ left: 20, right: 20, top: 5, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={80}
          />
          <YAxis tickFormatter={formatCurrency} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="Current Period" fill="#1976d2" />
          <Bar dataKey="Prior Period" fill="#90caf9" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(ComparisonChart);
