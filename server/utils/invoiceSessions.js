import { findActivePatient } from "~/server/utils/activeEntities";
import { creditSessions, reconcileUnbilled } from "~/server/utils/sessionBalance";

/**
 * How many sessions an invoice gives. Sessions come from the invoice items (package rows,
 * a snapshot taken when the invoice was made). Legacy invoices without items fall back to
 * matching the package by `invoice_type` name. `invoice` must include `invoice_item`.
 */
export async function sessionsOnInvoice(db, invoice) {
  if (invoice.invoice_item?.length > 0) {
    return invoice.invoice_item
      .filter((item) => item.item_type === "Package")
      .reduce((sum, item) => sum + (item.sessions || 0), 0);
  }
  if (invoice.invoice_type && invoice.invoice_type !== "Other") {
    const matchingPackage = await db.renamedpackage.findFirst({
      where: { package_name: invoice.invoice_type, status: "Active", deleted_at: null },
    });
    return matchingPackage?.avail_session || 0;
  }
  return 0;
}

/**
 * Credit the package sessions of an invoice to its patient - exactly once.
 *
 * The `invoice.sessions_credited` flag is the only guard: it is claimed with an
 * atomic updateMany, so normal payment and the manual Paid toggle can never
 * double-credit. Sessions are credited when the invoice is paid; Zakat is only a label.
 *
 * Sessions come from the invoice items (package rows). Legacy invoices without
 * items fall back to matching the package by `invoice_type` name.
 *
 * @param {number} invoiceId
 * @param {object} [db] a Prisma transaction client; omit to run in its own transaction
 * @returns {Promise<{ credited: number, alreadyCredited?: boolean, reason?: string }>}
 */
export async function creditInvoiceSessions(invoiceId, db = null) {
  if (!db) {
    return prisma.$transaction((tx) => creditInvoiceSessions(invoiceId, tx));
  }

  const invoice = await db.invoice.findFirst({
    where: { invoice_id: invoiceId, deleted_at: null },
    include: { invoice_item: true },
  });

  if (!invoice) {
    return { credited: 0, reason: "invoice_not_found" };
  }

  if (invoice.sessions_credited) {
    return { credited: 0, alreadyCredited: true };
  }

  // Do not claim the flag when the patient cannot receive sessions (inactive or
  // deleted), so the credit is not silently lost.
  const patient = invoice.patient_id
    ? await findActivePatient(db, invoice.patient_id, { patient_id: true, available_session: true })
    : null;

  const sessions = await sessionsOnInvoice(db, invoice);

  if (sessions <= 0) {
    // Nothing to credit (product / other invoice). Mark it done so the flag stays truthful.
    await db.invoice.updateMany({
      where: { invoice_id: invoiceId, sessions_credited: false },
      data: { sessions_credited: true },
    });
    return { credited: 0 };
  }

  if (!patient) {
    return { credited: 0, reason: "patient_inactive" };
  }

  const claim = await db.invoice.updateMany({
    where: { invoice_id: invoiceId, sessions_credited: false },
    data: { sessions_credited: true },
  });

  if (claim.count === 0) {
    return { credited: 0, alreadyCredited: true };
  }

  await creditSessions(db, patient.patient_id, sessions);

  // The new sessions may already cover appointments booked while this invoice was unpaid.
  await reconcileUnbilled(db, patient.patient_id);

  return { credited: sessions };
}
