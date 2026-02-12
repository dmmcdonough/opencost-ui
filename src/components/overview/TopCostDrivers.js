import React, { useState } from "react";
import { get, sortBy } from "lodash";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { toCurrency } from "../../util";

function descendingComparator(a, b, orderBy) {
  if (get(b, orderBy) < get(a, orderBy)) return -1;
  if (get(b, orderBy) > get(a, orderBy)) return 1;
  return 0;
}

function getComparator(order, orderBy) {
  return order === "desc"
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

function stableSort(array, comparator) {
  const stabilized = array.map((el, i) => [el, i]);
  stabilized.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });
  return stabilized.map((el) => el[0]);
}

const effColor = (v) => {
  if (v >= 0.8) return "#4caf50";
  if (v >= 0.5) return "#ff9800";
  return "#f44336";
};

const headCells = [
  { id: "name", numeric: false, label: "Namespace" },
  { id: "totalCost", numeric: true, label: "Cost (7d)" },
  { id: "costChange", numeric: true, label: "Change ($)" },
  { id: "costChangePct", numeric: true, label: "Change (%)" },
  { id: "efficiency", numeric: true, label: "Efficiency" },
];

const TopCostDrivers = ({ currentData, priorData, efficiencyData, onRowClick }) => {
  const [order, setOrder] = useState("desc");
  const [orderBy, setOrderBy] = useState("totalCost");

  if (!currentData || Object.keys(currentData).length === 0) {
    return (
      <Paper style={{ padding: 24 }}>
        <Typography variant="body2">No data available</Typography>
      </Paper>
    );
  }

  // Build merged rows
  const priorMap = {};
  if (priorData) {
    Object.values(priorData).forEach((item) => {
      priorMap[item.name] = item.totalCost || 0;
    });
  }

  const effMap = {};
  if (efficiencyData) {
    efficiencyData.forEach((item) => {
      const totalEff =
        item.cpuCost + item.ramCost > 0
          ? (item.cpuCost * item.cpuEfficiency + item.ramCost * item.memoryEfficiency) /
            (item.cpuCost + item.ramCost)
          : 0;
      effMap[item.name] = totalEff;
    });
  }

  const rows = Object.values(currentData)
    .filter((item) => item.name !== "__idle__" && item.name !== "__unallocated__")
    .map((item) => {
      const prior = priorMap[item.name] || 0;
      const change = item.totalCost - prior;
      const changePct = prior !== 0 ? (change / prior) * 100 : 0;
      return {
        name: item.name,
        totalCost: item.totalCost,
        costChange: change,
        costChangePct: changePct,
        efficiency: effMap[item.name] ?? item.totalEfficiency ?? 0,
      };
    });

  const sorted = stableSort(rows, getComparator(order, orderBy)).slice(0, 10);

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  return (
    <Paper>
      <div style={{ padding: "16px 24px" }}>
        <Typography variant="h6">Top Cost Drivers</Typography>
      </div>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              {headCells.map((cell) => (
                <TableCell
                  key={cell.id}
                  align={cell.numeric ? "right" : "left"}
                  sortDirection={orderBy === cell.id ? order : false}
                  style={{ fontWeight: 600 }}
                >
                  <TableSortLabel
                    active={orderBy === cell.id}
                    direction={orderBy === cell.id ? order : "asc"}
                    onClick={() => handleRequestSort(cell.id)}
                  >
                    {cell.label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((row) => {
              const changeColor =
                row.costChange > 0.01
                  ? "#f44336"
                  : row.costChange < -0.01
                    ? "#4caf50"
                    : undefined;

              return (
                <TableRow
                  key={row.name}
                  hover
                  onClick={() => onRowClick && onRowClick(row.name)}
                  sx={{
                    cursor: onRowClick ? "pointer" : "default",
                    "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.04)" },
                  }}
                >
                  <TableCell>{row.name}</TableCell>
                  <TableCell align="right">{toCurrency(row.totalCost)}</TableCell>
                  <TableCell align="right" style={{ color: changeColor }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                      {row.costChange > 0.01 && (
                        <ArrowUpwardIcon style={{ fontSize: 14 }} />
                      )}
                      {row.costChange < -0.01 && (
                        <ArrowDownwardIcon style={{ fontSize: 14 }} />
                      )}
                      {toCurrency(Math.abs(row.costChange))}
                    </span>
                  </TableCell>
                  <TableCell align="right" style={{ color: changeColor }}>
                    {row.costChangePct !== 0
                      ? `${row.costChangePct > 0 ? "+" : ""}${row.costChangePct.toFixed(1)}%`
                      : "-"}
                  </TableCell>
                  <TableCell align="right" style={{ color: effColor(row.efficiency) }}>
                    {(row.efficiency * 100).toFixed(1)}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default React.memo(TopCostDrivers);
