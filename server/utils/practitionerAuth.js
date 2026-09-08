import prisma from "~/server/utils/prisma";
import { normalizeEmail } from "~/server/utils/userEmail";

/**
 * Look a practitioner up by e-mail using the same matching as the registration
 * duplicate check (server/utils/userEmail.js), so the two endpoints can never
 * disagree about whether an account exists.
 */
export async function findPractitionerByEmail(email) {
  const trimmed = String(email || "").trim();
  const normalized = normalizeEmail(trimmed);
  if (!normalized) return null;

  return prisma.user.findFirst({
    where: {
      OR: [{ userEmail: trimmed }, { userEmail: normalized }],
    },
    include: {
      userrole: { include: { role: true } },
      user_practitioners: true,
    },
  });
}

/**
 * Explain why a practitioner cannot sign in, or return null when they can.
 *
 * The previous implementation folded every one of these conditions into a
 * single Prisma filter and reported them all as "<type> does not exist", which
 * was wrong for accounts that do exist but are pending, deactivated or
 * removed — and directly contradicted registration, which refuses the same
 * e-mail as already registered.
 *
 * Callers must verify the password before calling this, so account state is
 * only disclosed to someone who already holds the credentials.
 */
export function getPractitionerLoginError(user, type) {
  const label = String(type).toLowerCase();

  const hasPractitionerRole = (user.userrole || []).some(
    (entry) => entry.role?.roleName === "Practitioners"
  );

  const records = (user.user_practitioners || []).filter(
    (record) => record.type === type
  );
  const activeRecord = records.find((record) => record.deleted_at === null);

  if (!hasPractitionerRole || records.length === 0) {
    return {
      statusCode: 403,
      message: `This account is not registered as a ${label}.`,
      data: null,
    };
  }

  if (!activeRecord) {
    return {
      statusCode: 403,
      message: `This ${label} account has been removed. Please contact the administrator.`,
      data: null,
    };
  }

  if (user.userStatus !== "Active" || activeRecord.status !== "Active") {
    return {
      statusCode: 403,
      message: `Your ${label} account is awaiting administrator approval. You will be able to sign in once it has been activated.`,
      data: null,
    };
  }

  return null;
}

/** The practitioner record a signed-in user should act as. */
export function getActivePractitioner(user, type) {
  return (
    (user.user_practitioners || []).find(
      (record) => record.type === type && record.deleted_at === null
    ) || null
  );
}
