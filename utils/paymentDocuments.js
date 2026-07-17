// Shared invoice/receipt document logic used by both the payment history page
// and the unpaid-invoices page, so print (HTML) and download (PDF) stay in sync.

// Shared theme colours derived from the NeuroSpa Therapy logo
export const DOCUMENT_THEME = {
  green: '#2E7D32',
  greenDark: '#1B5E20',
  greenBright: '#43A047',
  greenTint: '#E8F5E9',
  ink: '#1F2937',
  muted: '#6B7280',
  border: '#D9E5DB',
};

export const COMPANY_INFO = {
  name: 'NeuroSpa Therapy',
  addressLines: [
    '1 - 4, Prima Bizwalk Business Park',
    'Jalan Tasik Prima 6/2, Taman Tasik Prima',
    '47150 Puchong, Selangor.',
  ],
};

export const formatPrice = (price) => {
  if (!price) return '0.00';
  return parseFloat(price)
    .toFixed(2)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatInvoiceId = (id) => {
  return `INV-${id.toString().padStart(3, '0')}`;
};

export const formatPaymentId = (id) => {
  return `PAY-${id.toString().padStart(3, '0')}`;
};

// Opens a print window and triggers printing once the content (incl. logo) has loaded
export const openPrintWindow = (html) => {
  const printWindow = window.open('', '', 'height=900,width=800');
  if (!printWindow) {
    alert('Please allow pop-ups to print this document.');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();

  let hasPrinted = false;
  const triggerPrint = () => {
    if (hasPrinted) return;
    hasPrinted = true;
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  printWindow.onload = triggerPrint;
  // Fallback in case the load event has already fired
  setTimeout(triggerPrint, 800);
};

// Builds a styled, invoice/receipt-like HTML document shared by print handlers
export const buildDocumentHtml = (opts) => {
  const {
    docType,
    docTitle,
    accentColor,
    metaRows = [],
    statusBadge = null,
    partyTitle,
    partyName,
    partyLines = [],
    lineItem,
    summaryRows = [],
    grandTotal,
    paymentInfo = null,
    terms = [],
    remark = '',
  } = opts;

  const logoUrl = `${window.location.origin}/img/neurspatherapy_logo.png`;
  const t = DOCUMENT_THEME;

  const metaHtml = metaRows
    .map(
      (row) => `
        <div class="meta-row">
          <span class="meta-label">${row.label}</span>
          <span class="meta-value">${row.value}</span>
        </div>`
    )
    .join('');

  const badgeHtml = statusBadge
    ? `<span class="status-badge ${statusBadge.paid ? 'is-paid' : 'is-unpaid'}">${statusBadge.text}</span>`
    : '';

  const partyLinesHtml = partyLines
    .filter(Boolean)
    .map((line) => `<div class="party-line">${line}</div>`)
    .join('');

  const summaryHtml = summaryRows
    .map(
      (row) => `
        <div class="summary-row">
          <span>${row.label}</span>
          <span>${row.value}</span>
        </div>`
    )
    .join('');

  const paymentInfoHtml =
    paymentInfo && paymentInfo.length
      ? `
        <div class="info-panel">
          <div class="info-panel-title">Payment Information</div>
          <div class="info-grid">
            ${paymentInfo
              .map(
                (row) => `
              <div class="info-item">
                <span class="info-label">${row.label}</span>
                <span class="info-value">${row.value}</span>
              </div>`
              )
              .join('')}
          </div>
        </div>`
      : '';

  const termsHtml = terms
    .map((term, i) => `<li>${i + 1}. ${term}</li>`)
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>${docTitle}</title>
      <style>
        * { box-sizing: border-box; }
        @page { margin: 16mm; size: A4; }
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          color: ${t.ink};
          margin: 0;
          padding: 0;
          font-size: 13px;
          line-height: 1.5;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .doc { max-width: 780px; margin: 0 auto; }
        .top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
        }
        .brand { display: flex; align-items: center; gap: 14px; }
        .brand img { height: 60px; width: auto; }
        .brand .company-name {
          font-size: 20px;
          font-weight: 700;
          color: ${t.greenDark};
          margin: 0;
        }
        .brand .company-address {
          font-size: 11px;
          color: ${t.muted};
          margin-top: 4px;
        }
        .doc-head { text-align: right; }
        .doc-type {
          font-size: 34px;
          font-weight: 800;
          letter-spacing: 4px;
          color: ${t.greenDark};
          margin: 0;
          line-height: 1;
        }
        .status-badge {
          display: inline-block;
          margin-top: 8px;
          padding: 4px 14px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #fff;
        }
        .status-badge.is-paid { background: ${t.green}; }
        .status-badge.is-unpaid { background: #E0A800; }
        .accent-bar {
          height: 4px;
          background: linear-gradient(90deg, ${t.greenDark}, ${t.greenBright});
          border-radius: 2px;
          margin: 16px 0 20px;
        }
        .meta-strip {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 40px;
          background: ${t.greenTint};
          border: 1px solid ${t.border};
          border-radius: 8px;
          padding: 12px 18px;
          margin-bottom: 22px;
        }
        .meta-row { display: flex; flex-direction: column; }
        .meta-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: ${t.muted};
        }
        .meta-value { font-size: 13px; font-weight: 600; color: ${t.ink}; }
        .party { margin-bottom: 18px; }
        .party-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          color: ${accentColor};
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .party-name { font-size: 15px; font-weight: 700; }
        .party-line { font-size: 12px; color: ${t.muted}; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
        thead th {
          background: ${accentColor};
          color: #fff;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          text-align: left;
          padding: 10px 12px;
        }
        thead th.num, tbody td.num { text-align: right; }
        tbody td {
          padding: 12px;
          border-bottom: 1px solid ${t.border};
          font-size: 12.5px;
          vertical-align: top;
        }
        .totals { display: flex; justify-content: flex-end; }
        .summary-box { width: 280px; }
        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 12px;
          font-size: 13px;
          color: ${t.muted};
        }
        .summary-row.grand {
          background: ${t.greenTint};
          border: 1px solid ${t.border};
          border-radius: 8px;
          margin-top: 6px;
          padding: 12px;
          font-size: 15px;
          font-weight: 700;
          color: ${t.greenDark};
        }
        .info-panel {
          margin-top: 24px;
          border: 1px solid ${t.border};
          border-left: 4px solid ${accentColor};
          border-radius: 8px;
          padding: 14px 18px;
          background: #FBFDFB;
        }
        .info-panel-title {
          font-size: 12px;
          font-weight: 700;
          color: ${accentColor};
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 10px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 24px;
        }
        .info-item { display: flex; flex-direction: column; }
        .info-label {
          font-size: 10px;
          text-transform: uppercase;
          color: ${t.muted};
          letter-spacing: 0.5px;
        }
        .info-value { font-size: 12.5px; font-weight: 600; }
        .sign-remark {
          display: flex;
          justify-content: space-between;
          gap: 40px;
          margin-top: 48px;
        }
        .sign-block, .remark-block { flex: 1; }
        .sign-line {
          margin-top: 42px;
          border-top: 1.5px solid ${t.ink};
          padding-top: 6px;
          font-size: 12px;
          font-weight: 600;
          color: ${t.ink};
        }
        .remark-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
          color: ${accentColor};
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .remark-box {
          min-height: 60px;
          border: 1px solid ${t.border};
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 12px;
          color: ${t.muted};
        }
        .terms {
          margin-top: 34px;
          border-top: 1px solid ${t.border};
          padding-top: 14px;
        }
        .terms-title {
          font-size: 11px;
          font-weight: 700;
          color: ${accentColor};
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }
        .terms ul { margin: 0; padding: 0; list-style: none; }
        .terms li { font-size: 10.5px; color: ${t.muted}; margin: 2px 0; }
        .footer {
          text-align: center;
          margin-top: 22px;
          padding-top: 12px;
          border-top: 2px solid ${accentColor};
          font-size: 11px;
          color: ${t.muted};
        }
        .footer strong { color: ${t.greenDark}; }
      </style>
    </head>
    <body>
      <div class="doc">
        <div class="top">
          <div class="brand">
            <img src="${logoUrl}" alt="${COMPANY_INFO.name} logo" />
            <div>
              <p class="company-name">${COMPANY_INFO.name}</p>
              <div class="company-address">${COMPANY_INFO.addressLines.join('<br>')}</div>
            </div>
          </div>
          <div class="doc-head">
            <p class="doc-type">${docType}</p>
            ${badgeHtml}
          </div>
        </div>

        <div class="accent-bar"></div>

        <div class="meta-strip">${metaHtml}</div>

        <div class="party">
          <div class="party-title">${partyTitle}</div>
          <div class="party-name">${partyName}</div>
          ${partyLinesHtml}
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="num">Price</th>
              <th class="num">Discount</th>
              <th class="num">Qty</th>
              <th class="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${lineItem.description || 'N/A'}</td>
              <td class="num">RM ${formatPrice(lineItem.amount)}</td>
              <td class="num">RM 0.00</td>
              <td class="num">1</td>
              <td class="num">RM ${formatPrice(lineItem.amount)}</td>
            </tr>
          </tbody>
        </table>

        <div class="totals">
          <div class="summary-box">
            ${summaryHtml}
            <div class="summary-row grand">
              <span>Grand Total</span>
              <span>${grandTotal}</span>
            </div>
          </div>
        </div>

        ${paymentInfoHtml}

        <div class="sign-remark">
          <div class="sign-block">
            <div class="sign-line">Authorised Signature</div>
          </div>
          <div class="remark-block">
            <div class="remark-title">Remark</div>
            <div class="remark-box">${remark || ''}</div>
          </div>
        </div>

        <div class="terms">
          <div class="terms-title">Terms &amp; Conditions</div>
          <ul>${termsHtml}</ul>
        </div>

        <div class="footer">
          <p>Thank you for choosing <strong>${COMPANY_INFO.name}</strong>.</p>
          <p>Generated on ${new Date().toLocaleDateString('en-MY')} &middot; This is a computer generated document.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Shared document option builders so print (HTML) and download (PDF) stay in sync
export const buildInvoiceDocOptions = (invoice) => ({
  docType: 'INVOICE',
  docTitle: `Invoice ${formatInvoiceId(invoice.invoice_id)}`,
  accentColor: DOCUMENT_THEME.green,
  metaRows: [
    { label: 'Invoice No', value: formatInvoiceId(invoice.invoice_id) },
    { label: 'Sales Date', value: formatDate(invoice.date) },
    { label: 'Due Date', value: formatDate(invoice.due_date) },
    { label: 'Issued Date', value: new Date().toLocaleDateString('en-MY') },
  ],
  statusBadge: { text: invoice.status, paid: invoice.status === 'Paid' },
  partyTitle: 'BILL TO',
  partyName: invoice.patient_name,
  partyLines: [
    invoice.patient_id ? `Patient ID: ${invoice.patient_id}` : '',
    invoice.invoice_type ? `Invoice Type: ${invoice.invoice_type}` : '',
  ],
  lineItem: { description: invoice.description, amount: invoice.amount },
  summaryRows: [
    { label: 'Sub Total', value: `RM ${formatPrice(invoice.amount)}` },
    { label: 'Tax (0%)', value: 'RM 0.00' },
  ],
  grandTotal: `RM ${formatPrice(invoice.amount)}`,
  paymentInfo: null,
  terms: [
    'Payment is due within 30 days of the invoice date.',
    'Late payments may incur additional charges.',
    'This is a computer generated invoice.',
  ],
  remark: 'This is a computer generated invoice. No signature required.',
});

export const buildReceiptDocOptions = (payment) => {
  const paymentInfo = [
    { label: 'Payment Date', value: formatDate(payment.created_at) },
    { label: 'Payment Method', value: payment.method || 'N/A' },
  ];
  if (payment.bank_name) {
    paymentInfo.push({ label: 'Bank / Provider', value: payment.bank_name });
  }
  if (payment.reference_code) {
    paymentInfo.push({ label: 'Reference Code', value: payment.reference_code });
  }

  return {
    docType: 'RECEIPT',
    docTitle: `Receipt ${formatPaymentId(payment.payment_id)}`,
    accentColor: DOCUMENT_THEME.greenBright,
    metaRows: [
      { label: 'Receipt No', value: formatPaymentId(payment.payment_id) },
      { label: 'Invoice No', value: formatInvoiceId(payment.invoice_id) },
      { label: 'Payment Date', value: formatDate(payment.created_at) },
      { label: 'Issued Date', value: new Date().toLocaleDateString('en-MY') },
    ],
    statusBadge: { text: 'Paid', paid: true },
    partyTitle: 'PAID BY',
    partyName: payment.patient_name,
    partyLines: [
      payment.patient_id ? `Patient ID: ${payment.patient_id}` : '',
      payment.invoice_type ? `Invoice Type: ${payment.invoice_type}` : '',
    ],
    lineItem: { description: payment.invoice_description, amount: payment.amount },
    summaryRows: [
      { label: 'Sub Total', value: `RM ${formatPrice(payment.amount)}` },
      { label: 'Tax (0%)', value: 'RM 0.00' },
      { label: `Paid (${payment.method || 'N/A'})`, value: `RM ${formatPrice(payment.amount)}` },
    ],
    grandTotal: `RM ${formatPrice(payment.amount)}`,
    paymentInfo,
    terms: [
      'This receipt confirms that payment has been received in full.',
      'Please retain this receipt for your records.',
      'This is a computer generated receipt.',
    ],
    remark: 'Payment received with thanks. No signature required.',
  };
};

// Converts a #RRGGBB string into an [r, g, b] array for jsPDF
const hexToRgb = (hex) => {
  const clean = String(hex).replace('#', '');
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
};

// Loads an image URL as a data URL so it can be embedded in the PDF (logo)
const loadImageDataUrl = async (url) => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

// Renders a text-based (vector) PDF that mirrors the new print design.
// Accepts the same option shape as buildDocumentHtml().
export const renderDocumentPdf = async (jsPDF, opts) => {
  const t = DOCUMENT_THEME;
  const accent = hexToRgb(opts.accentColor);
  const greenDark = hexToRgb(t.greenDark);
  const greenTint = hexToRgb(t.greenTint);
  const ink = hexToRgb(t.ink);
  const muted = hexToRgb(t.muted);
  const border = hexToRgb(t.border);
  const unpaid = hexToRgb('#E0A800');

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 16;
  const rightX = pageWidth - marginX;
  const contentW = pageWidth - marginX * 2;
  const bottomLimit = pageHeight - 14;

  const setFill = (c) => pdf.setFillColor(c[0], c[1], c[2]);
  const setText = (c) => pdf.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c) => pdf.setDrawColor(c[0], c[1], c[2]);
  const ensureSpace = (y, needed) => {
    if (y + needed > bottomLimit) {
      pdf.addPage();
      return 18;
    }
    return y;
  };

  // ---- Header: logo + company (left), doc type + badge (right) ----
  let y = 16;
  let textX = marginX;
  const logoDataUrl = await loadImageDataUrl(`${window.location.origin}/img/neurspatherapy_logo.png`);
  if (logoDataUrl) {
    try {
      const props = pdf.getImageProperties(logoDataUrl);
      const logoH = 16;
      const logoW = props.width && props.height ? (props.width / props.height) * logoH : 16;
      pdf.addImage(logoDataUrl, 'PNG', marginX, y, logoW, logoH);
      textX = marginX + logoW + 4;
    } catch {
      textX = marginX;
    }
  }

  setText(greenDark);
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(15);
  pdf.text(COMPANY_INFO.name, textX, y + 6);
  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(8);
  setText(muted);
  COMPANY_INFO.addressLines.forEach((line, i) => {
    pdf.text(line, textX, y + 11 + i * 4);
  });

  // Doc type (right) — dark green, bold
  setText(greenDark);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(26);
  pdf.text(opts.docType, rightX, y + 7, { align: 'right' });

  // Status badge (right, below doc type)
  if (opts.statusBadge) {
    const badgeText = String(opts.statusBadge.text || '').toUpperCase();
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(8);
    const badgeTextW = pdf.getTextWidth(badgeText);
    const badgeW = badgeTextW + 10;
    const badgeH = 6;
    const badgeX = rightX - badgeW;
    const badgeY = y + 11;
    setFill(opts.statusBadge.paid ? hexToRgb(t.green) : unpaid);
    pdf.roundedRect(badgeX, badgeY, badgeW, badgeH, 3, 3, 'F');
    setText([255, 255, 255]);
    pdf.text(badgeText, badgeX + badgeW / 2, badgeY + 4.1, { align: 'center' });
  }

  // ---- Accent bar ----
  y = 36;
  setFill(greenDark);
  pdf.rect(marginX, y, contentW, 1.4, 'F');
  y += 8;

  // ---- Meta strip ----
  const metaRows = opts.metaRows || [];
  const stripH = 14;
  setFill(greenTint);
  setDraw(border);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(marginX, y, contentW, stripH, 2, 2, 'FD');
  const cols = Math.max(metaRows.length, 1);
  const colW = contentW / cols;
  metaRows.forEach((row, i) => {
    const cx = marginX + i * colW + 4;
    setText(muted);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(7);
    pdf.text(String(row.label).toUpperCase(), cx, y + 5.5);
    setText(ink);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(9.5);
    pdf.text(String(row.value), cx, y + 10.5);
  });
  y += stripH + 8;

  // ---- Party ----
  setText(accent);
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(8);
  pdf.text(String(opts.partyTitle).toUpperCase(), marginX, y);
  y += 5;
  setText(ink);
  pdf.setFontSize(12);
  pdf.text(String(opts.partyName || 'N/A'), marginX, y);
  y += 5;
  setText(muted);
  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(9);
  (opts.partyLines || []).filter(Boolean).forEach((line) => {
    pdf.text(String(line), marginX, y);
    y += 4.5;
  });
  y += 4;

  // ---- Line item table ----
  const priceR = marginX + 110;
  const discR = marginX + 134;
  const qtyR = marginX + 150;
  const amountR = rightX;
  const descX = marginX + 2;

  const headH = 8;
  setFill(accent);
  pdf.rect(marginX, y, contentW, headH, 'F');
  setText([255, 255, 255]);
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(8.5);
  pdf.text('DESCRIPTION', descX, y + 5.3);
  pdf.text('PRICE', priceR, y + 5.3, { align: 'right' });
  pdf.text('DISCOUNT', discR, y + 5.3, { align: 'right' });
  pdf.text('QTY', qtyR, y + 5.3, { align: 'right' });
  pdf.text('AMOUNT', amountR, y + 5.3, { align: 'right' });
  y += headH;

  const rowH = 8;
  setText(ink);
  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(9);
  const rawDesc = String(opts.lineItem?.description || 'N/A');
  const descLine = pdf.splitTextToSize(rawDesc, priceR - descX - 4)[0] || rawDesc;
  pdf.text(descLine, descX, y + 5.3);
  const amountStr = `RM ${formatPrice(opts.lineItem?.amount)}`;
  pdf.text(amountStr, priceR, y + 5.3, { align: 'right' });
  pdf.text('RM 0.00', discR, y + 5.3, { align: 'right' });
  pdf.text('1', qtyR, y + 5.3, { align: 'right' });
  pdf.text(amountStr, amountR, y + 5.3, { align: 'right' });
  setDraw(border);
  pdf.setLineWidth(0.3);
  pdf.line(marginX, y + rowH, rightX, y + rowH);
  y += rowH + 8;

  // ---- Totals ----
  const boxW = 90;
  const boxX = rightX - boxW;
  const labelX = boxX + 2;
  (opts.summaryRows || []).forEach((row) => {
    setText(muted);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(9.5);
    pdf.text(String(row.label), labelX, y);
    pdf.text(String(row.value), rightX - 2, y, { align: 'right' });
    y += 6;
  });
  const gtH = 11;
  setFill(greenTint);
  setDraw(border);
  pdf.roundedRect(boxX, y, boxW, gtH, 2, 2, 'FD');
  setText(greenDark);
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(11);
  pdf.text('Grand Total', boxX + 4, y + 7);
  pdf.text(String(opts.grandTotal), rightX - 4, y + 7, { align: 'right' });
  y += gtH + 10;

  // ---- Payment information panel ----
  if (opts.paymentInfo && opts.paymentInfo.length) {
    const gridRows = Math.ceil(opts.paymentInfo.length / 2);
    const panelH = 14 + gridRows * 10;
    y = ensureSpace(y, panelH + 4);
    setDraw(border);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(marginX, y, contentW, panelH, 2, 2, 'D');
    setFill(accent);
    pdf.rect(marginX, y, 1.4, panelH, 'F');
    setText(accent);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(8.5);
    pdf.text('PAYMENT INFORMATION', marginX + 5, y + 7);
    opts.paymentInfo.forEach((row, i) => {
      const col = i % 2;
      const rowIdx = Math.floor(i / 2);
      const ix = marginX + 5 + col * (contentW / 2);
      const iy = y + 14 + rowIdx * 10;
      setText(muted);
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(7);
      pdf.text(String(row.label).toUpperCase(), ix, iy);
      setText(ink);
      pdf.setFont(undefined, 'bold');
      pdf.setFontSize(9.5);
      pdf.text(String(row.value), ix, iy + 4.5);
    });
    y += panelH + 12;
  }

  // ---- Signature & remark ----
  y = ensureSpace(y, 30);
  const srTop = y;
  const signLineY = srTop + 16;
  setDraw(ink);
  pdf.setLineWidth(0.5);
  pdf.line(marginX, signLineY, marginX + 80, signLineY);
  setText(ink);
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(9);
  pdf.text('Authorised Signature', marginX, signLineY + 5);

  const remarkX = marginX + contentW / 2 + 6;
  const remarkW = rightX - remarkX;
  setText(accent);
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(8);
  pdf.text('REMARK', remarkX, srTop + 3);
  setDraw(border);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(remarkX, srTop + 5, remarkW, 16, 2, 2, 'D');
  setText(muted);
  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(8.5);
  const remarkLines = pdf.splitTextToSize(String(opts.remark || ''), remarkW - 6);
  pdf.text(remarkLines, remarkX + 3, srTop + 10);
  y = Math.max(signLineY + 5, srTop + 21) + 12;

  // ---- Terms ----
  const terms = opts.terms || [];
  y = ensureSpace(y, 12 + terms.length * 4);
  setDraw(border);
  pdf.setLineWidth(0.3);
  pdf.line(marginX, y, rightX, y);
  y += 6;
  setText(accent);
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(8);
  pdf.text('TERMS & CONDITIONS', marginX, y);
  y += 5;
  setText(muted);
  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(7.5);
  terms.forEach((term, i) => {
    const lines = pdf.splitTextToSize(`${i + 1}. ${term}`, contentW);
    pdf.text(lines, marginX, y);
    y += lines.length * 3.6;
  });
  y += 8;

  // ---- Footer ----
  y = ensureSpace(y, 18);
  setDraw(accent);
  pdf.setLineWidth(0.6);
  pdf.line(marginX, y, rightX, y);
  y += 6;
  setText(greenDark);
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(9);
  pdf.text(`Thank you for choosing ${COMPANY_INFO.name}.`, pageWidth / 2, y, { align: 'center' });
  y += 5;
  setText(muted);
  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(7.5);
  pdf.text(
    `Generated on ${new Date().toLocaleDateString('en-MY')} · This is a computer generated document.`,
    pageWidth / 2,
    y,
    { align: 'center' },
  );

  return pdf;
};
