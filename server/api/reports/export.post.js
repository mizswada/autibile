import { requireAdmin } from "~/server/utils/reports/guard";
import { sanitizeReportConfig } from "~/server/utils/reports/config";
import { fetchReportRows } from "~/server/utils/reports/fetchers";
import { buildReportWorkbook } from "~/server/utils/reports/excel";

function buildFilename(label) {
  const date = new Date().toISOString().slice(0, 10);
  return `${label.replace(/\s+/g, "_")}_Report_${date}.xlsx`;
}

export default defineEventHandler(async (event) => {
  const guard = requireAdmin(event);
  if (!guard.ok) {
    setResponseStatus(event, guard.statusCode);
    return { success: false, message: guard.message };
  }

  try {
    const body = await readBody(event);
    const { def, columnKeys, filters, groupBy, sort, filterSummary } =
      sanitizeReportConfig(body);

    const rows = await fetchReportRows(def.key, filters);

    const buffer = await buildReportWorkbook({
      def,
      columnKeys,
      rows,
      groupBy,
      sort,
      filterSummary,
    });

    setHeader(
      event,
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    setHeader(
      event,
      "Content-Disposition",
      `attachment; filename="${buildFilename(def.label)}"`,
    );
    return buffer;
  } catch (error) {
    console.error("POST /api/reports/export error:", error);
    setResponseStatus(event, 400);
    return { success: false, message: error.message || "Failed to export report" };
  }
});
