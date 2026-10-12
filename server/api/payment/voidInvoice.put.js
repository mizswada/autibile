import { requireAdmin } from "~/server/utils/reports/guard";

/**
 * Void an Unpaid invoice (admin only).
 *
 * - Pending parent payments on it are rejected.
 * - Appointments it billed go back to "unbilled" so they can be billed again.
 * - A Paid invoice cannot be voided here (that would be a refund), and neither can one whose
 *   sessions were already credited (older invoices); adjust those sessions manually instead.
 */
export default defineEventHandler(async (event) => {
  try {
    const guard = requireAdmin(event);
    if (!guard.ok) {
      return { statusCode: guard.statusCode, message: guard.message };
    }

    const body = (await readBody(event)) || {};
    const invoiceId = parseInt(body.invoiceID, 10);
    const reason = String(body.reason || "").trim();

    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      return { statusCode: 400, message: "Invalid invoice ID" };
    }
    if (reason.length < 3) {
      return { statusCode: 400, message: "A reason is required to void an invoice." };
    }
    if (reason.length > 500) {
      return { statusCode: 400, message: "The reason is too long (500 characters at most)." };
    }

    const invoice = await prisma.invoice.findFirst({
      where: { invoice_id: invoiceId, deleted_at: null },
      select: { invoice_id: true, status: true, sessions_credited: true },
    });

    if (!invoice) {
      return { statusCode: 404, message: "Invoice not found" };
    }
    if (invoice.status === "Void") {
      return { statusCode: 400, message: "This invoice is already void." };
    }
    if (invoice.status !== "Unpaid") {
      return { statusCode: 400, message: "Only an unpaid invoice can be voided." };
    }
    if (invoice.sessions_credited) {
      return {
        statusCode: 400,
        message:
          "Sessions were already credited for this invoice, so it cannot be voided. Adjust the sessions manually first.",
      };
    }

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      // Only an Unpaid invoice can be voided; this also stops a payment approved at the same time.
      const claim = await tx.invoice.updateMany({
        where: { invoice_id: invoiceId, status: "Unpaid", sessions_credited: false },
        data: { status: "Void", voided_at: now, void_reason: reason, update_at: now },
      });
      if (claim.count === 0) {
        throw new Error("The invoice changed while voiding. Refresh and try again.");
      }

      const rejected = await tx.payment.updateMany({
        where: { invoice_id: invoiceId, status: "Pending", deleted_at: null },
        data: {
          status: "Rejected",
          rejection_reason: "Invoice voided",
          approved_at: now,
          updated_at: now,
        },
      });

      // Appointments stay marked needs_billing, so they are unbilled again.
      const unlinked = await tx.appointments.updateMany({
        where: { invoice_id: invoiceId },
        data: { invoice_id: null, updated_at: now },
      });

      return { rejectedPayments: rejected.count, unlinkedAppointments: unlinked.count };
    });

    return {
      statusCode: 200,
      message: "Invoice voided.",
      data: result,
    };
  } catch (error) {
    console.error("Error voiding invoice:", error);
    return { statusCode: 500, message: error.message || "Internal server error" };
  }
});
