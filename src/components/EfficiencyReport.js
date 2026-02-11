import React, { useState, useEffect } from "react";
import { get } from "lodash";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";
import EfficiencyChart from "./EfficiencyChart";

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

const formatPercent = (v) => `${(v * 100).toFixed(1)}%`;

const formatBytes = (bytes) => {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

const formatCurrency = (v) => `$${v.toFixed(2)}`;

const effColor = (v) => {
  if (v >= 0.8) return "#4caf50";
  if (v >= 0.5) return "#ff9800";
  return "#f44336";
};

const headCells = [
  { id: "name", numeric: false, label: "Name", width: "auto" },
  { id: "memoryEfficiency", numeric: true, label: "Mem Eff.", width: 90 },
  { id: "cpuEfficiency", numeric: true, label: "CPU Eff.", width: 90 },
  { id: "ramBytesRequested", numeric: true, label: "RAM Req.", width: 100 },
  { id: "ramBytesUsed", numeric: true, label: "RAM Used", width: 100 },
  { id: "recommendedRamRequest", numeric: true, label: "Rec. RAM", width: 100 },
  { id: "currentTotalCost", numeric: true, label: "Cost", width: 90 },
  { id: "costSavings", numeric: true, label: "Savings", width: 90 },
];

const EfficiencyReport = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <Typography variant="body2" style={{ padding: 24 }}>
        No results
      </Typography>
    );
  }

  const [order, setOrder] = useState("desc");
  const [orderBy, setOrderBy] = useState("costSavings");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    setPage(0);
  }, [data.length]);

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const sorted = stableSort(data, getComparator(order, orderBy));
  const pageData = sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <div>
      <EfficiencyChart data={data} />
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              {headCells.map((cell) => (
                <TableCell
                  key={cell.id}
                  align={cell.numeric ? "right" : "left"}
                  style={{ width: cell.width, fontWeight: 600 }}
                  sortDirection={orderBy === cell.id ? order : false}
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
            {pageData.map((row) => (
              <TableRow key={row.name} hover>
                <TableCell>{row.name}</TableCell>
                <TableCell align="right" style={{ color: effColor(row.memoryEfficiency) }}>
                  {formatPercent(row.memoryEfficiency)}
                </TableCell>
                <TableCell align="right" style={{ color: effColor(row.cpuEfficiency) }}>
                  {formatPercent(row.cpuEfficiency)}
                </TableCell>
                <TableCell align="right">{formatBytes(row.ramBytesRequested)}</TableCell>
                <TableCell align="right">{formatBytes(row.ramBytesUsed)}</TableCell>
                <TableCell align="right">{formatBytes(row.recommendedRamRequest)}</TableCell>
                <TableCell align="right">{formatCurrency(row.currentTotalCost)}</TableCell>
                <TableCell align="right" style={{ color: row.costSavings > 0 ? "#4caf50" : undefined }}>
                  {formatCurrency(row.costSavings)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[10, 25, 50]}
        component="div"
        count={data.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(e, p) => setPage(p)}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
      />
    </div>
  );
};

export default React.memo(EfficiencyReport);
