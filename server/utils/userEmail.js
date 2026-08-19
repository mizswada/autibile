import prisma from "~/server/utils/prisma";

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export async function findUserByEmail(email, excludeUserId) {
  const trimmed = String(email || "").trim();
  const normalized = normalizeEmail(trimmed);
  if (!normalized) return null;

  const where = {
    OR: [{ userEmail: trimmed }, { userEmail: normalized }],
  };

  if (excludeUserId) {
    where.userID = { not: parseInt(excludeUserId, 10) };
  }

  return prisma.user.findFirst({
    where,
    select: { userID: true },
  });
}

export async function getEmailAlreadyRegisteredError(email, excludeUserId) {
  const existing = await findUserByEmail(email, excludeUserId);
  if (!existing) return null;

  return {
    statusCode: 409,
    message: excludeUserId
      ? "This email address is already in use by another account"
      : "This email is already registered. Please log in or use a different email.",
  };
}

