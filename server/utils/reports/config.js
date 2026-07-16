import { getReportDefinition } from "~/utils/reportDefinitions";

/**
 * Validates and normalizes a report request body against the entity definition.
 * Throws on unknown entity.
 */
export function sanitizeReportConfig(body = {}) {
  const def = getReportDefinition(body.entity);
  if (!def) {
    throw new Error(`Unknown report entity: ${body.entity}`);
  }

  const validKeys = def.columns.map((c) => c.key);
  let columnKeys = Array.isArray(body.columns)
    ? body.columns.filter((k) => validKeys.includes(k))
    : [];
  if (!columnKeys.length) columnKeys = [...def.defaultColumns];
  // Keep definition order.
  columnKeys = validKeys.filter((k) => columnKeys.includes(k));

  const groupBy =
    body.groupBy && def.groupableKeys.includes(body.groupBy)
      ? body.groupBy
      : null;

  const sortKey =
    body.sort?.key && def.sortableKeys.includes(body.sort.key)
      ? body.sort.key
      : def.defaultSort.key;
  const sortDir = body.sort?.dir === "desc" ? "desc" : "asc";

  const filters =
    body.filters && typeof body.filters === "object" ? body.filters : {};

  return {
    def,
    columnKeys,
    filters,
    groupBy,
    sort: { key: sortKey, dir: sortDir },
    filterSummary:
      typeof body.filterSummary === "string" ? body.filterSummary : "",
  };
}
