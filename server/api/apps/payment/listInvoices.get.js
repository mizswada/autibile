import { getParentAuthContext } from "~/server/utils/appsParentAuth";

function deriveInvoiceStatus(invoice, latestPayment) {
  if (invoice.status === "Paid") {
    return "Paid";
  }
  if (latestPayment?.status === "Pending") {
    return "Pending Approval";
  }
  if (latestPayment?.status === "Rejected") {
    return "Rejected";
  }
  return "Unpaid";
}

export default defineEventHandler(async (event) => {
  try {
    const auth = await getParentAuthContext(event);
    if (!auth.ok) {
      return { statusCode: auth.statusCode, message: auth.message };
    }

    const query = getQuery(event);
    const { status, limit = 50, offset = 0 } = query;

    const whereClause = {
      deleted_at: null,
      patient_id: { in: auth.patientIds.length ? auth.patientIds : [-1] },
    };

    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: {
        user_patients: {
          select: {
            patient_id: true,
            fullname: true,
            nickname: true,
          },
        },
        payment: {
          where: { deleted_at: null },
          orderBy: { created_at: "desc" },
          take: 1,
          select: {
            payment_id: true,
            status: true,
            method: true,
            reference_code: true,
            created_at: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    const transformed = invoices.map((invoice) => {
      const latestPayment = invoice.payment[0] || null;
      return {
        invoice_id: invoice.invoice_id,
        patient_id: invoice.patient_id,
        patient_name: invoice.user_patients?.fullname || "Unknown Patient",
        patient_nickname: invoice.user_patients?.nickname || null,
        invoice_type: invoice.invoice_type,
        description: invoice.description,
        amount: invoice.amount,
        date: invoice.date,
        status: invoice.status,
        payment_status: latestPayment?.status || null,
        derived_status: deriveInvoiceStatus(invoice, latestPayment),
        latest_payment: latestPayment,
      };
    });

    const filtered = status ? transformed.filter((item) => item.derived_status === status) : transformed;

    return {
      statusCode: 200,
      message: "Invoices retrieved successfully",
      data: filtered,
    };
  } catch (error) {
    console.error("Error listing parent invoices:", error);
    return { statusCode: 500, message: "Internal server error" };
  }
});
