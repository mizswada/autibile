import { findLinkedActivePatient } from "~/server/utils/activeEntities";
import { creditInvoiceSessions } from "~/server/utils/invoiceSessions";

const ITEM_TYPES = ["Package", "Product", "Other"];

const round2 = (value) => Math.round(value * 100) / 100;
const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 3)}...` : text);

/**
 * Validate one submitted row and resolve it against the catalog.
 * Returns { item } for the invoice_item row, or { error }.
 */
async function buildItem(row, index) {
  const label = `Item ${index + 1}`;
  const type = row?.type;

  if (!ITEM_TYPES.includes(type)) {
    return { error: `${label}: invalid item type` };
  }

  const qty = parseInt(row.qty ?? 1, 10);
  if (isNaN(qty) || qty < 1) {
    return { error: `${label}: quantity must be at least 1` };
  }

  const submittedPrice = parseFloat(row.unitPrice);
  const notes = row.description ? String(row.description).trim() : "";

  if (type === "Package") {
    const pkg = await prisma.renamedpackage.findFirst({
      where: { package_id: parseInt(row.packageId, 10) || -1, status: "Active", deleted_at: null },
    });
    if (!pkg) {
      return { error: `${label}: therapy package not found or inactive` };
    }
    // The package price may be adjusted on the invoice, as before.
    const unitPrice = !isNaN(submittedPrice) && submittedPrice > 0 ? submittedPrice : Number(pkg.amount || 0);
    if (unitPrice <= 0) {
      return { error: `${label}: price must be greater than 0` };
    }
    return {
      item: {
        item_type: "Package",
        package_id: pkg.package_id,
        name: pkg.package_name,
        description: notes || pkg.description || null,
        qty,
        unit_price: round2(unitPrice),
        subtotal: round2(unitPrice * qty),
        // Snapshot, so later package edits never change what this invoice credited.
        sessions: (pkg.avail_session || 0) * qty,
      },
    };
  }

  if (type === "Product") {
    const product = await prisma.products.findFirst({
      where: { product_id: parseInt(row.productId, 10) || -1, status: "Active", deleted_at: null },
    });
    if (!product) {
      return { error: `${label}: product not found or inactive` };
    }
    // Product price always comes from the catalog.
    const unitPrice = Number(product.amount || 0);
    if (unitPrice <= 0) {
      return { error: `${label}: product has no price` };
    }
    return {
      item: {
        item_type: "Product",
        product_id: product.product_id,
        name: product.product_name,
        description: notes || product.description || null,
        qty,
        unit_price: round2(unitPrice),
        subtotal: round2(unitPrice * qty),
        sessions: 0,
      },
    };
  }

  const name = row.name ? String(row.name).trim() : "";
  if (!name) {
    return { error: `${label}: a name is required for "Other"` };
  }
  if (isNaN(submittedPrice) || submittedPrice <= 0) {
    return { error: `${label}: price must be greater than 0` };
  }
  return {
    item: {
      item_type: "Other",
      name: truncate(name, 255),
      description: notes || null,
      qty,
      unit_price: round2(submittedPrice),
      subtotal: round2(submittedPrice * qty),
      sessions: 0,
    },
  };
}

export default defineEventHandler(async (event) => {
  try {
    // Extract userID from the session context for authorization
    const { userID } = event.context.user || {};
    if (!userID) {
      return {
        statusCode: 401,
        message: "Unauthorized: Missing user session",
      };
    }

    const body = await readBody(event);

    const { patientID, patientName, date, items, notes, payLater } = body;

    // Basic validation
    if (!patientID || !patientName || !date) {
      return {
        statusCode: 400,
        message: "Missing required fields: patientID, patientName and date are required",
      };
    }

    if (!Array.isArray(items) || items.length === 0) {
      return {
        statusCode: 400,
        message: "Add at least one item to the invoice",
      };
    }

    // Validate patientID is a valid integer
    const patientIdValue = parseInt(patientID);
    if (isNaN(patientIdValue) || patientIdValue <= 0) {
      return {
        statusCode: 400,
        message: "Invalid patient ID",
      };
    }

    // Validate date format
    const invoiceDate = new Date(date);
    if (isNaN(invoiceDate.getTime())) {
      return {
        statusCode: 400,
        message: "Invalid date format",
      };
    }

    // Verify patient exists, is active, and linked to an active parent
    const patientExists = await findLinkedActivePatient(prisma, patientIdValue);

    if (!patientExists) {
      return {
        statusCode: 404,
        message: "Patient not found, inactive, or not linked to an active parent",
      };
    }

    // Resolve every row against the catalog; prices and totals are computed here, not trusted from the client.
    const invoiceItems = [];
    for (let i = 0; i < items.length; i++) {
      const { item, error } = await buildItem(items[i], i);
      if (error) {
        return { statusCode: 400, message: error };
      }
      invoiceItems.push(item);
    }

    const totalAmount = round2(invoiceItems.reduce((sum, item) => sum + item.subtotal, 0));
    if (totalAmount <= 0) {
      return {
        statusCode: 400,
        message: "Amount must be a positive number",
      };
    }

    const isPayLater = payLater === true || payLater === "true";
    const hasSessions = invoiceItems.some((item) => item.item_type === "Package" && item.sessions > 0);
    if (isPayLater && !hasSessions) {
      return {
        statusCode: 400,
        message: "Pay later (Zakat) only applies to invoices that include a therapy package",
      };
    }

    // Summary strings keep every existing screen (and the mobile app) working.
    const itemLabels = invoiceItems.map((item) => (item.qty > 1 ? `${item.name} x${item.qty}` : item.name));
    const invoiceType = truncate(itemLabels.join(" + "), 255);
    const extraNotes = notes ? String(notes).trim() : "";
    const description = truncate(
      extraNotes ? `${itemLabels.join("; ")} - ${extraNotes}` : itemLabels.join("; "),
      500,
    );

    const now = new Date();
    const invoiceData = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          patient_id: patientIdValue,
          invoice_type: invoiceType,
          description,
          amount: totalAmount,
          date: invoiceDate,
          // Invoices are always created as Unpaid. Payment must go through the
          // "make payment" flow so a receipt is generated. A pay-later (Zakat)
          // invoice only gets its sessions credited up front.
          status: "Unpaid",
          pay_later: isPayLater,
          created_at: now,
          update_at: now,
          invoice_item: { create: invoiceItems },
        },
        include: { invoice_item: true },
      });

      if (isPayLater) {
        await creditInvoiceSessions(created.invoice_id, tx);
      }

      return created;
    });

    return {
      statusCode: 201,
      message: isPayLater
        ? "Invoice created successfully. Sessions were credited now; the invoice stays unpaid."
        : "Invoice created successfully",
      data: {
        invoice_id: invoiceData.invoice_id,
        patient_id: invoiceData.patient_id,
        patient_name: patientName,
        invoice_type: invoiceData.invoice_type,
        description: invoiceData.description,
        amount: invoiceData.amount,
        date: invoiceData.date,
        status: invoiceData.status,
        pay_later: invoiceData.pay_later,
        items: invoiceData.invoice_item,
        created_at: invoiceData.created_at,
      },
    };

  } catch (error) {
    console.error("Error creating invoice:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
});
