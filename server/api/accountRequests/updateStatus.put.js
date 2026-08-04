import { DateTime } from "luxon";
import sha256 from "crypto-js/sha256.js";
import { requireAdmin } from "~/server/utils/reports/guard";
import { REQUEST_TYPES } from "~/server/utils/accountRequestHelpers";
import {
  escapeHtml,
  findRegisteredUserByEmail,
  sendAccountRequestEmail,
} from "~/server/utils/accountRequestHelpers";
import { TEMP_RESET_PASSWORD } from "~/server/utils/accountRequestHandlers";
import { fulfillAccountDeletion } from "~/server/utils/fulfillAccountDeletion";

const ALLOWED_STATUSES = ["Pending", "In Progress", "Completed", "Rejected"];

/**
 * Requests created before user_id existed have no linked account,
 * so fall back to matching the email they were submitted with.
 */
async function resolveTargetUserId(request) {
  if (request.user_id) return request.user_id;

  const user = await findRegisteredUserByEmail(request.email || "");
  return user?.userID || null;
}

async function notifyUserOfCompletion(request, status, adminNotes) {
  if (!request.email) return;

  const name = escapeHtml(request.full_name || "User");
  const notesBlock = adminNotes
    ? `<p><strong>Admin notes:</strong> ${escapeHtml(adminNotes)}</p>`
    : "";

  if (status === "Completed") {
    if (request.request_type === REQUEST_TYPES.PASSWORD_RESET) {
      await sendAccountRequestEmail({
        to: request.email,
        subject: "Your Autibile password reset has been approved",
        html: `
          <p>Hi ${name},</p>
          <p>Your password reset request (#${request.request_id}) has been approved.</p>
          <p>Your temporary password is <strong>${TEMP_RESET_PASSWORD}</strong>. Please sign in and change your password immediately.</p>
          ${notesBlock}
          <p>— Autibile Support</p>
        `,
      });
      return;
    }

    await sendAccountRequestEmail({
      to: request.email,
      subject: "Your Autibile account deletion request has been completed",
      html: `
        <p>Hi ${name},</p>
        <p>Your account deletion request (#${request.request_id}) has been approved and your account has been deactivated.</p>
        ${notesBlock}
        <p>— Autibile Support</p>
      `,
    });
    return;
  }

  if (status === "Rejected") {
    await sendAccountRequestEmail({
      to: request.email,
      subject: "Your Autibile account request was rejected",
      html: `
        <p>Hi ${name},</p>
        <p>Your account request (#${request.request_id}) could not be approved.</p>
        ${notesBlock}
        <p>Please contact support if you need further assistance.</p>
        <p>— Autibile Support</p>
      `,
    });
  }
}

export default defineEventHandler(async (event) => {
  const guard = requireAdmin(event);
  if (!guard.ok) {
    return {
      statusCode: guard.statusCode,
      message: guard.message,
    };
  }

  try {
    const { userID } = event.context.user || {};
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

    const existing = await prisma.account_requests.findFirst({
      where: {
        request_id: requestId,
        deleted_at: null,
      },
    });

    if (!existing) {
      return {
        statusCode: 404,
        message: "Account request not found.",
      };
    }

    let resolvedUserId = existing.user_id;

    if (status === "Completed" && existing.status !== "Completed") {
      const targetUserId = await resolveTargetUserId(existing);

      if (!targetUserId) {
        return {
          statusCode: 400,
          message: `No active account was found for ${existing.email}. Please verify the account before completing this request.`,
        };
      }

      resolvedUserId = targetUserId;

      if (existing.request_type === REQUEST_TYPES.PASSWORD_RESET) {
        await prisma.user.update({
          where: { userID: targetUserId },
          data: {
            userPassword: sha256(TEMP_RESET_PASSWORD).toString(),
            userModifiedDate: new Date(),
          },
        });
      } else {
        await fulfillAccountDeletion({
          userId: targetUserId,
          accountType: existing.account_type,
        });
      }
    }

    const now = DateTime.now().toISO();
    const isTerminal = status === "Completed" || status === "Rejected";

    const updated = await prisma.account_requests.update({
      where: { request_id: requestId },
      data: {
        status,
        ...(adminNotes !== undefined ? { admin_notes: adminNotes || null } : {}),
        ...(!existing.user_id && resolvedUserId ? { user_id: resolvedUserId } : {}),
        updated_at: now,
        processed_by: parseInt(userID),
        processed_at: isTerminal ? now : existing.processed_at,
      },
    });

    if (isTerminal) {
      try {
        await notifyUserOfCompletion(updated, status, adminNotes);
      } catch (emailError) {
        console.log("Failed to send account request status email:", emailError);
      }
    }

    return {
      statusCode: 200,
      message: "Request status updated.",
      data: {
        requestId: updated.request_id,
        status: updated.status,
        requestType: updated.request_type,
      },
    };
  } catch (error) {
    console.error("PUT /api/accountRequests/updateStatus error:", error);
    return {
      statusCode: 500,
      message: error.message || "Internal Server Error",
    };
  }
});
