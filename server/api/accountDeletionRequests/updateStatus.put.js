import { DateTime } from "luxon";

const ALLOWED_STATUSES = ["Pending", "In Progress", "Completed", "Rejected"];

export default defineEventHandler(async (event) => {
  try {
    const { userID } = event.context.user || {};

    if (!userID) {
      return {
        statusCode: 401,
        message: "Unauthorized",
      };
    }

    const validatedUser = await prisma.user.findFirst({
      where: { userID: parseInt(userID) },
    });

    if (!validatedUser) {
      return {
        statusCode: 401,
        message: "Unauthorized",
      };
    }

    const body = await readBody(event);
    const requestId = parseInt(body?.requestId);
    const status = (body?.status || "").trim();
    const adminNotes =
      body?.adminNotes !== undefined ? String(body.adminNotes).trim() : undefined;

    if (!requestId || Number.isNaN(requestId)) {
      return {
        statusCode: 400,
        message: "requestId is required.",
      };
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      return {
        statusCode: 400,
        message: `status must be one of: ${ALLOWED_STATUSES.join(", ")}`,
      };
    }

    const existing = await prisma.account_deletion_requests.findFirst({
      where: {
        request_id: requestId,
        deleted_at: null,
      },
    });

    if (!existing) {
      return {
        statusCode: 404,
        message: "Deletion request not found.",
      };
    }

    const now = DateTime.now().toISO();
    const isTerminal = status === "Completed" || status === "Rejected";

    const updated = await prisma.account_deletion_requests.update({
      where: { request_id: requestId },
      data: {
        status,
        ...(adminNotes !== undefined ? { admin_notes: adminNotes || null } : {}),
        updated_at: now,
        processed_by: parseInt(userID),
        processed_at: isTerminal ? now : existing.processed_at,
      },
    });

    return {
      statusCode: 200,
      message: "Request status updated.",
      data: {
        requestId: updated.request_id,
        status: updated.status,
      },
    };
  } catch (error) {
    console.error("PUT /api/accountDeletionRequests/updateStatus error:", error);
    return {
      statusCode: 500,
      message: "Internal Server Error",
      error: error.message,
    };
  }
});
