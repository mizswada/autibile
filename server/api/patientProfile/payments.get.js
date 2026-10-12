import { requireAdmin } from "~/server/utils/reports/guard";

const round2 = (value) => Math.round(value * 100) / 100;

export default defineEventHandler(async (event) => {
  try {
    // Sales figures are for administrators only (doctors/therapists also open the patient profile).
    const guard = requireAdmin(event);
    if (!guard.ok) {
      return { statusCode: guard.statusCode, message: guard.message };
    }

    const patientId = parseInt(getQuery(event).patientId);
    if (isNaN(patientId) || patientId <= 0) {
      return {
        statusCode: 400,
        message: "Invalid patient ID",
      };
    }

    const invoices = await prisma.invoice.findMany({
      where: { patient_id: patientId, deleted_at: null },
      orderBy: [{ date: "desc" }, { invoice_id: "desc" }],
      include: {
        invoice_item: { orderBy: { item_id: "asc" } },
        payment: {
          where: { deleted_at: null },
          orderBy: { created_at: "desc" },
          take: 1,
        },
      },
    });

    // Invoices created before items existed carry only a name in `invoice_type`.
    // Classify those by matching the name against the catalog.
    const hasLegacy = invoices.some((invoice) => invoice.invoice_item.length === 0);
    const packageNames = new Set();
    const productNames = new Set();
    if (hasLegacy) {
      const [packages, products] = await Promise.all([
        prisma.renamedpackage.findMany({ select: { package_name: true } }),
        prisma.products.findMany({ select: { product_name: true } }),
      ]);
      packages.forEach((pkg) => pkg.package_name && packageNames.add(pkg.package_name));
      products.forEach((product) => product.product_name && productNames.add(product.product_name));
    }

    let totalSales = 0;
    let outstanding = 0;
    let therapySales = 0;
    let productSales = 0;
    let otherSales = 0;
    let lastPaymentDate = null;

    const rows = invoices.map((invoice) => {
      const amount = Number(invoice.amount || 0);
      const latestPayment = invoice.payment[0] || null;

      let displayStatus = "Unpaid";
      if (invoice.status === "Paid") displayStatus = "Paid";
      else if (latestPayment?.status === "Pending") displayStatus = "Pending Approval";
      else if (invoice.pay_later) displayStatus = "Zakat: awaiting payment";

      if (invoice.status === "Paid") {
        totalSales += amount;
        if (latestPayment && (!lastPaymentDate || latestPayment.created_at > lastPaymentDate)) {
          lastPaymentDate = latestPayment.created_at;
        }

        if (invoice.invoice_item.length > 0) {
          for (const item of invoice.invoice_item) {
            const subtotal = Number(item.subtotal || 0);
            if (item.item_type === "Package") therapySales += subtotal;
            else if (item.item_type === "Product") productSales += subtotal;
            else otherSales += subtotal;
          }
        } else if (packageNames.has(invoice.invoice_type)) {
          therapySales += amount;
        } else if (productNames.has(invoice.invoice_type)) {
          productSales += amount;
        } else {
          otherSales += amount;
        }
      } else {
        outstanding += amount;
      }

      return {
        invoice_id: invoice.invoice_id,
        patient_id: invoice.patient_id,
        invoice_type: invoice.invoice_type,
        description: invoice.description,
        amount,
        date: invoice.date,
        status: invoice.status,
        display_status: displayStatus,
        pay_later: invoice.pay_later,
        items: invoice.invoice_item,
        payment_id: latestPayment?.status === "Approved" ? latestPayment.payment_id : null,
        payment_method: latestPayment?.method || null,
        payment_date: latestPayment?.created_at || null,
        created_at: invoice.created_at,
      };
    });

    return {
      statusCode: 200,
      message: "Payments retrieved successfully",
      data: {
        summary: {
          totalSales: round2(totalSales),
          outstanding: round2(outstanding),
          invoiceCount: invoices.length,
          paidCount: invoices.filter((invoice) => invoice.status === "Paid").length,
          lastPaymentDate,
          therapySales: round2(therapySales),
          productSales: round2(productSales),
          otherSales: round2(otherSales),
        },
        invoices: rows,
      },
    };
  } catch (error) {
    console.error("Error fetching patient payments:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
});
