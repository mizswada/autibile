const sameName = (a, b) =>
  String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

/**
 * Packages and products share one invoice-type dropdown and sessions are credited
 * by matching the invoice type to a package NAME, so a name must be unique across
 * both (ignoring case and deleted rows). Returns "package", "product" or null.
 */
export async function findCatalogNameConflict(
  name,
  { excludePackageId = null, excludeProductId = null } = {},
) {
  const wanted = String(name || "").trim();
  if (!wanted) return null;

  const [packages, products] = await Promise.all([
    prisma.renamedpackage.findMany({
      where: { deleted_at: null },
      select: { package_id: true, package_name: true },
    }),
    prisma.products.findMany({
      where: { deleted_at: null },
      select: { product_id: true, product_name: true },
    }),
  ]);

  if (packages.some((p) => p.package_id !== excludePackageId && sameName(p.package_name, wanted))) {
    return "package";
  }
  if (products.some((p) => p.product_id !== excludeProductId && sameName(p.product_name, wanted))) {
    return "product";
  }
  return null;
}

export function catalogNameConflictMessage(name, kind) {
  return `A ${kind} named "${String(name).trim()}" already exists. Use a different name, or edit the existing ${kind}.`;
}
