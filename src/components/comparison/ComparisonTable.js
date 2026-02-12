import React, { useState } from "react";
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

const headCells = [
  { id: "name", numeric: false, label: "Name" },
  { id: "currentCost", numeric: true, label: "Current Period" },
  { id: "priorCost", numeric: true, label: "Prior Period" },
  { id: "change", numeric: true, label: "Change ($)" },
  { id: "changePct", numeric: true, label: "Change (%)" },
];

const ComparisonTable = ({ rows }) => {
  const [order, setOrder] = useState("desc");
  const [orderBy, setOrderBy] = useState("currentCost");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  if (!rows || rows.length === 0) {
    return (
      <Typography variant="body2" style={{ padding: 24 }}>
        No results
      </Typography>
    );
  }

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const sorted = stableSort(rows, getComparator(order, orderBy));
  const pageData = sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // Compute totals
  const totals = rows.reduce(
    (acc, row) => ({
      currentCost: acc.currentCost + row.currentCost,
      priorCost: acc.priorCost + row.priorCost,
      change: acc.change + row.change,
    }),
    { currentCost: 0, priorCost: 0, change: 0 },
  );
  totals.changePct = totals.priorCost !== 0 ? (totals.change / totals.priorCost) * 100 : 0;

  const changeColor = (val) => {
    if (val > 0.01) return "#f44336";
    if (val < -0.01) return "#4caf50";
    return undefined;
  };

  return (
    <div>
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
            <TableRow>
              <TableCell style={{ fontWeight: 500 }}>Totals</TableCell>
              <TableCell align="right" style={{ fontWeight: 500 }}>
                {toCurrency(totals.currentCost)}
              </TableCell>
              <TableCell align="right" style={{ fontWeight: 500 }}>
                {toCurrency(totals.priorCost)}
              </TableCell>
              <TableCell
                align="right"
                style={{ fontWeight: 500, color: changeColor(totals.change) }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                  {totals.change > 0.01 && <ArrowUpwardIcon style={{ fontSize: 14 }} />}
                  {totals.change < -0.01 && <ArrowDownwardIcon style={{ fontSize: 14 }} />}
                  {toCurrency(Math.abs(totals.change))}
                </span>
              </TableCell>
              <TableCell
                align="right"
                style={{ fontWeight: 500, color: changeColor(totals.change) }}
              >
                {totals.changePct !== 0
                  ? `${totals.changePct > 0 ? "+" : ""}${totals.changePct.toFixed(1)}%`
                  : "-"}
              </TableCell>
            </TableRow>
            {pageData.map((row) => (
              <TableRow key={row.name} hover>
                <TableCell>{row.name}</TableCell>
                <TableCell align="right">{toCurrency(row.currentCost)}</TableCell>
                <TableCell align="right">{toCurrency(row.priorCost)}</TableCell>
                <TableCell align="right" style={{ color: changeColor(row.change) }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                    {row.change > 0.01 && <ArrowUpwardIcon style={{ fontSize: 14 }} />}
                    {row.change < -0.01 && <ArrowDownwardIcon style={{ fontSize: 14 }} />}
                    {toCurrency(Math.abs(row.change))}
                  </span>
                </TableCell>
                <TableCell align="right" style={{ color: changeColor(row.change) }}>
                  {row.changePct !== 0
                    ? `${row.changePct > 0 ? "+" : ""}${row.changePct.toFixed(1)}%`
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[10, 25, 50]}
        component="div"
        count={rows.length}
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

export default React.memo(ComparisonTable);
