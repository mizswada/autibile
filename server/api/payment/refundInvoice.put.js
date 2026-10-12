import { getVerifiedAdmin } from "~/server/utils/adminSession";
import { sessionsOnInvoice } from "~/server/utils/invoiceSessions";
import { adjustBalance } from "~/server/utils/sessionBalance";

function clientIp(event) {
  const forwarded = event.node.req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return event.node.req.socket?.remoteAddress || null;
}

/**
 * Full refund of a Paid invoice (admin only). Partial refunds are not supported, in line
 * with full-amount payments.
 *
 * - The invoice becomes Void with the reason "Refunded: ...", so it can no longer be paid.
 * - Its approved payments are marked Refunded (they stop counting as income / receipts).
 * - The sessions it credited are taken back through a logged balance adjustment.
 * - Appointments it billed go back to "unbilled"; the ones the taken-back sessions no longer
 *   cover are marked unbilled too.
 *
 * The money itself is handed back outside the system.
 */
export default defineEventHandler(async (event) => {
  try {
    const session = await getVerifiedAdmin(event);
    if (!session.ok) {
      return { statusCode: session.statusCode, message: session.message };
    }

    const body = (await readBody(event)) || {};
    const invoiceId = parseInt(body.invoiceID, 10);
    const reason = String(body.reason || "").trim();

    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      return { statusCode: 400, message: "Invalid invoice ID" };
    }
    if (reason.length < 3) {
      return { statusCode: 400, message: "A reason is required to refund an invoice." };
    }
    if (reason.length > 450) {
      return { statusCode: 400, message: "The reason is too long (450 characters at most)." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { invoice_id: invoiceId, deleted_at: null },
        include: { invoice_item: true },
      });
      if (!invoice) {
        return { error: { statusCode: 404, message: "Invoice not found" } };
      }
      if (invoice.status === "Void") {
        return { error: { statusCode: 400, message: "This invoice is already void or refunded." } };
      }
      if (invoice.status !== "Paid") {
        return { error: { statusCode: 400, message: "Only a paid invoice can be refunded. Void an unpaid invoice instead." } };
      }

      const now = new Date();

      // Atomic claim: two refunds (or a refund and a status change) cannot both win.
      const claim = await tx.invoice.updateMany({
        where: { invoice_id: invoiceId, status: "Paid" },
        data: {
          status: "Void",
          voided_at: now,
          void_reason: `Refunded: ${reason}`,
          update_at: now,
        },
      });
      if (claim.count === 0) {
        return { error: { statusCode: 409, message: "The invoice changed while refunding. Refresh and try again." } };
      }

      const refundedPayments = await tx.payment.updateMany({
        where: { invoice_id: invoiceId, status: "Approved", deleted_at: null },
        data: { status: "Refunded", updated_at: now },
      });

      // A parent payment still waiting on this invoice can no longer be approved.
      await tx.payment.updateMany({
        where: { invoice_id: invoiceId, status: "Pending", deleted_at: null },
        data: {
          status: "Rejected",
          rejection_reason: "Invoice refunded",
          approved_at: now,
          updated_at: now,
        },
      });

      // Take back exactly what this invoice credited (nothing when it never credited).
      let sessionsTakenBack = 0;
      if (invoice.sessions_credited && invoice.patient_id != null) {
        sessionsTakenBack = await sessionsOnInvoice(tx, invoice);
      }

      // Appointments it billed are unbilled again (needs_billing stays on).
      const unlinked = await tx.appointments.updateMany({
        where: { invoice_id: invoiceId },
        data: { invoice_id: null, updated_at: now },
      });

      let balanceAfter = null;
      if (invoice.patient_id != null && sessionsTakenBack > 0) {
        const adjusted = await adjustBalance(tx, invoice.patient_id, -sessionsTakenBack, {
          reason: `Refund of invoice INV-${invoiceId}: ${reason}`.slice(0, 500),
          admin: session.admin,
          ip: clientIp(event),
        });
        balanceAfter = adjusted.balanceAfter;
      }

      return {
        data: {
          refundedPayments: refundedPayments.count,
          sessionsTakenBack,
          unlinkedAppointments: unlinked.count,
          balanceAfter,
        },
      };
    });

    if (result.error) {
      return result.error;
    }

    return {
      statusCode: 200,
      message: "Invoice refunded.",
      data: result.data,
    };
  } catch (error) {
    console.error("Error refunding invoice:", error);
    return { statusCode: 500, message: "Internal server error" };
  }
});
