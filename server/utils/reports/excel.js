import ExcelJS from "exceljs";
import { getColumnLabel } from "~/utils/reportDefinitions";

/**
 * Builds a formatted .xlsx workbook for a report.
 *
 * When `groupBy` is provided, rows are rendered as grouped sections in a single
 * sheet: a group header, its data rows (collapsible outline), and a subtotal
 * row, followed by a grand total. Without grouping, a single data block plus a
 * grand total is produced.
 */

const COLORS = {
  title: "FF4F46E5",
  header: "FF4F46E5",
  headerText: "FFFFFFFF",
  groupHeader: "FFE0E7FF",
  subtotal: "FFF1F5F9",
  grandTotal: "FFC7D2FE",
  border: "FFE5E7EB",
  zebra: "FFF8FAFC",
};

const THIN_BORDER = {
  top: { style: "thin", color: { argb: COLORS.border } },
  left: { style: "thin", color: { argb: COLORS.border } },
  bottom: { style: "thin", color: { argb: COLORS.border } },
  right: { style: "thin", color: { argb: COLORS.border } },
};

function resolveColumns(def, columnKeys) {
  const keys =
    Array.isArray(columnKeys) && columnKeys.length
      ? columnKeys
      : def.defaultColumns;
  // Preserve the definition order, keep only valid selected keys.
  return def.columns.filter((c) => keys.includes(c.key));
}

function numFmtFor(type) {
  switch (type) {
    case "date":
      return "dd/mm/yyyy";
    case "datetime":
      return "dd/mm/yyyy hh:mm";
    case "currency":
      return "\"RM\" #,##0.00";
    case "number":
      return "0.##";
    default:
      return null;
  }
}

function cellValueFor(col, raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  switch (col.type) {
    case "date":
    case "datetime":
      return raw instanceof Date ? raw : new Date(raw);
    case "number":
    case "currency":
      return typeof raw === "number" ? raw : Number(raw);
    default:
      return raw; // string / time
  }
}

function compareValues(a, b, type) {
  if (a === null || a === undefined) {
    return b === null || b === undefined ? 0 : -1;
  }
  if (b === null || b === undefined) return 1;

  if (type === "number" || type === "currency") return Number(a) - Number(b);
  if (type === "date" || type === "datetime") {
    return new Date(a).getTime() - new Date(b).getTime();
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

function formatGroupValue(col, value) {
  if (value === null || value === undefined || value === "") return "(Blank)";
  if (col.type === "date" || col.type === "datetime") {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  }
  return String(value);
}

function computeAggregate(rows, key, agg) {
  const nums = rows
    .map((r) => r[key])
    .filter((v) => v !== null && v !== undefined && v !== "")
    .map((v) => Number(v))
    .filter((n) => !Number.isNaN(n));
  if (!nums.length) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  if (agg === "avg") return sum / nums.length;
  return sum;
}

function autoWidths(cols, rows) {
  return cols.map((col) => {
    let max = String(col.label).length;
    for (const row of rows) {
      const v = row[col.key];
      if (v === null || v === undefined) continue;
      let text;
      if (v instanceof Date) text = "dd/mm/yyyy hh:mm";
      else text = String(v);
      if (text.length > max) max = text.length;
    }
    const base = col.width || max + 2;
    return Math.min(Math.max(base, 8), 50);
  });
}

export async function buildReportWorkbook({
  def,
  columnKeys,
  rows,
  groupBy,
  sort,
  filterSummary,
  generatedAt = new Date(),
}) {
  const cols = resolveColumns(def, columnKeys);
  const colCount = cols.length;
  const summable = (def.summable || []).filter((s) =>
    cols.some((c) => c.key === s.key),
  );

  const groupCol = groupBy ? def.columns.find((c) => c.key === groupBy) : null;
  const sortCol = sort?.key
    ? def.columns.find((c) => c.key === sort.key)
    : null;
  const sortDir = sort?.dir === "desc" ? -1 : 1;

  // Sort: by group first (asc), then by chosen sort column.
  const sorted = rows.slice().sort((a, b) => {
    if (groupCol) {
      const g = compareValues(a[groupCol.key], b[groupCol.key], groupCol.type);
      if (g !== 0) return g;
    }
    if (sortCol) {
      return compareValues(a[sortCol.key], b[sortCol.key], sortCol.type) * sortDir;
    }
    return 0;
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Autibile";
  workbook.created = generatedAt;

  const ws = workbook.addWorksheet(def.sheetName || def.label, {
    properties: { outlineProperties: { summaryBelow: true } },
  });

  const widths = autoWidths(cols, sorted);
  cols.forEach((col, i) => {
    ws.getColumn(i + 1).width = widths[i];
  });

  const lastColLetter = ws.getColumn(colCount).letter;

  // --- Title ---
  ws.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = ws.getCell("A1");
  titleCell.value = `${def.label} Report`;
  titleCell.font = { bold: true, size: 16, color: { argb: COLORS.headerText } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.title },
  };
  ws.getRow(1).height = 26;

  // --- Subtitle (generated + filters) ---
  ws.mergeCells(`A2:${lastColLetter}2`);
  const genCell = ws.getCell("A2");
  genCell.value = `Generated: ${generatedAt.toLocaleString("en-GB")}`;
  genCell.font = { italic: true, size: 10, color: { argb: "FF6B7280" } };

  let headerRowNumber = 4;
  if (filterSummary) {
    ws.mergeCells(`A3:${lastColLetter}3`);
    const fCell = ws.getCell("A3");
    fCell.value = `Filters: ${filterSummary}`;
    fCell.font = { size: 10, color: { argb: "FF6B7280" } };
    headerRowNumber = 5;
  }

  // --- Header row ---
  const headerRow = ws.getRow(headerRowNumber);
  cols.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.label;
    cell.font = { bold: true, color: { argb: COLORS.headerText } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.header },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = THIN_BORDER;
  });
  headerRow.height = 20;

  ws.views = [{ state: "frozen", ySplit: headerRowNumber }];
  ws.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber, column: colCount },
  };

  let currentRow = headerRowNumber + 1;

  const writeDataRow = (row, outlineLevel, zebra) => {
    const r = ws.getRow(currentRow);
    cols.forEach((col, i) => {
      const cell = r.getCell(i + 1);
      cell.value = cellValueFor(col, row[col.key]);
      const fmt = numFmtFor(col.type);
      if (fmt) cell.numFmt = fmt;
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: "middle", wrapText: false };
      if (zebra) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.zebra },
        };
      }
    });
    if (outlineLevel) r.outlineLevel = outlineLevel;
    currentRow += 1;
  };

  const writeSummaryRow = (label, groupRows, fillColor, outlineLevel) => {
    const r = ws.getRow(currentRow);
    const firstCell = r.getCell(1);
    firstCell.value = label;
    firstCell.font = { bold: true };
    summable.forEach((s) => {
      const colIndex = cols.findIndex((c) => c.key === s.key);
      if (colIndex === -1) return;
      const col = cols[colIndex];
      const value = computeAggregate(groupRows, s.key, s.agg);
      const cell = r.getCell(colIndex + 1);
      cell.value = value;
      const fmt = numFmtFor(col.type);
      if (fmt) cell.numFmt = fmt;
      cell.font = { bold: true };
    });
    for (let i = 1; i <= colCount; i += 1) {
      const cell = r.getCell(i);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fillColor },
      };
      cell.border = THIN_BORDER;
    }
    if (outlineLevel) r.outlineLevel = outlineLevel;
    currentRow += 1;
  };

  const writeGroupHeader = (label) => {
    const r = ws.getRow(currentRow);
    ws.mergeCells(currentRow, 1, currentRow, colCount);
    const cell = r.getCell(1);
    cell.value = label;
    cell.font = { bold: true, size: 12, color: { argb: "FF3730A3" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.groupHeader },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    currentRow += 1;
  };

  if (groupCol) {
    // Partition already-sorted rows into contiguous groups.
    let i = 0;
    let zebraToggle = false;
    while (i < sorted.length) {
      const groupKey = formatGroupValue(groupCol, sorted[i][groupCol.key]);
      const groupRows = [];
      while (
        i < sorted.length &&
        formatGroupValue(groupCol, sorted[i][groupCol.key]) === groupKey
      ) {
        groupRows.push(sorted[i]);
        i += 1;
      }
      writeGroupHeader(
        `${getColumnLabel(def, groupCol.key)}: ${groupKey}  (${groupRows.length})`,
      );
      zebraToggle = false;
      for (const row of groupRows) {
        writeDataRow(row, 1, zebraToggle);
        zebraToggle = !zebraToggle;
      }
      writeSummaryRow(
        `Subtotal (${groupRows.length})`,
        groupRows,
        COLORS.subtotal,
        1,
      );
    }
  } else {
    let zebraToggle = false;
    for (const row of sorted) {
      writeDataRow(row, 0, zebraToggle);
      zebraToggle = !zebraToggle;
    }
  }

  // --- Grand total ---
  writeSummaryRow(`Grand Total (${sorted.length})`, sorted, COLORS.grandTotal, 0);

  return workbook.xlsx.writeBuffer();
}
