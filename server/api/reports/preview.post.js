import { requireAdmin } from "~/server/utils/reports/guard";
import { sanitizeReportConfig } from "~/server/utils/reports/config";
import { fetchReportRows } from "~/server/utils/reports/fetchers";

const PREVIEW_LIMIT = 100;

function formatPreviewValue(col, v) {
  if (v === null || v === undefined || v === "") return "";
  switch (col.type) {
    case "date":
      return new Date(v).toLocaleDateString("en-GB");
    case "datetime":
      return new Date(v).toLocaleString("en-GB");
    case "currency":
      return `RM ${Number(v).toFixed(2)}`;
    case "number":
      return Number(v);
    default:
      return v;
  }
}

export default defineEventHandler(async (event) => {
  const guard = requireAdmin(event);
  if (!guard.ok) {
    setResponseStatus(event, guard.statusCode);
    return { success: false, message: guard.message };
  }

  try {
    const body = await readBody(event);
    const { def, columnKeys, filters } = sanitizeReportConfig(body);

    const rows = await fetchReportRows(def.key, filters);
    const cols = def.columns.filter((c) => columnKeys.includes(c.key));

    const previewRows = rows.slice(0, PREVIEW_LIMIT).map((row) => {
      const obj = {};
      cols.forEach((col) => {
        obj[col.label] = formatPreviewValue(col, row[col.key]);
      });
      return obj;
    });

    return {
      success: true,
      data: {
        fields: cols.map((c) => c.label),
        rows: previewRows,
        total: rows.length,
        shown: previewRows.length,
      },
    };
  } catch (error) {
    console.error("POST /api/reports/preview error:", error);
    setResponseStatus(event, 400);
    return { success: false, message: error.message || "Failed to build preview" };
  }
});
