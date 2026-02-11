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
import { sortBy } from "lodash";

const formatPercent = (value) => `${(value * 100).toFixed(0)}%`;

const formatBytes = (bytes) => {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

const formatCurrency = (value) => `$${value.toFixed(2)}`;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

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
      <div>CPU Efficiency: {formatPercent(data.cpuEfficiency)}</div>
      <div>Memory Efficiency: {formatPercent(data.memoryEfficiency)}</div>
      <div>
        RAM: {formatBytes(data.ramBytesUsed)} / {formatBytes(data.ramBytesRequested)}
      </div>
      <div>Potential Savings: {formatCurrency(data.costSavings)}</div>
    </div>
  );
};

const EfficiencyChart = ({ data, n = 15, height = 400 }) => {
  if (!data || data.length === 0) {
    return <Typography variant="body2">No data</Typography>;
  }

  const sorted = sortBy(data, (d) => -d.costSavings).slice(0, n);

  const chartData = sorted.map((d) => ({
    name: d.name.length > 30 ? d.name.slice(0, 27) + "..." : d.name,
    cpuEfficiency: d.cpuEfficiency,
    memoryEfficiency: d.memoryEfficiency,
    costSavings: d.costSavings,
    ramBytesUsed: d.ramBytesUsed,
    ramBytesRequested: d.ramBytesRequested,
  }));

  return (
    <div style={{ marginBottom: 16 }}>
      <Typography variant="subtitle2" style={{ marginBottom: 8 }}>
        Top {Math.min(n, data.length)} Workloads by Potential Savings
      </Typography>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 120, right: 20, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" domain={[0, "auto"]} tickFormatter={formatPercent} />
          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="cpuEfficiency" name="CPU Efficiency" fill="#1976d2" barSize={12} />
          <Bar dataKey="memoryEfficiency" name="Memory Efficiency" fill="#9c27b0" barSize={12} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(EfficiencyChart);
