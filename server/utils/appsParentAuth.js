import jwt from "jsonwebtoken";
import {
  ACTIVE_STATUS,
  activeParentWhere,
} from "~/server/utils/activeEntities";

const ENV = useRuntimeConfig();

function getBearerToken(event) {
  const authHeader = event.req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

export async function getParentAuthContext(event) {
  const token = getBearerToken(event);
  if (!token) {
    return { ok: false, statusCode: 401, message: "Unauthorized: Missing bearer token" };
  }

  let payload;
  try {
    payload = jwt.verify(token, ENV.auth.secretAccess);
  } catch (error) {
    return { ok: false, statusCode: 401, message: "Unauthorized: Invalid or expired token" };
  }

  if (!payload?.roles || !payload.roles.includes("Parents")) {
    return { ok: false, statusCode: 403, message: "Forbidden: Parent role required" };
  }

  const user = await prisma.user.findFirst({
    where: {
      userUsername: payload.username,
      userStatus: "Active",
    },
    include: {
      user_parents: {
        where: activeParentWhere(),
        select: {
          parent_id: true,
        },
        take: 1,
      },
    },
  });

  if (!user || !user.user_parents?.length) {
    return { ok: false, statusCode: 403, message: "Forbidden: Parent account not found" };
  }

  const parentId = user.user_parents[0].parent_id;
  const parentChildren = await prisma.user_parent_patient.findMany({
    where: {
      parent_id: parentId,
      user_patients: {
        deleted_at: null,
        status: ACTIVE_STATUS,
      },
    },
    select: { patient_id: true },
  });

  return {
    ok: true,
    userID: user.userID,
    parentId,
    patientIds: parentChildren.map((item) => item.patient_id),
  };
}
