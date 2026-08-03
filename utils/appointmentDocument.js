import { COMPANY_INFO, DOCUMENT_THEME } from './paymentDocuments';

const hexToRgb = (hex) => {
  const clean = String(hex).replace('#', '');
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
};

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

export function formatAppointmentId(id) {
  return `APT-${String(id).padStart(4, '0')}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getStatusLabel(status, statusMapping) {
  return statusMapping[Number(status)]?.label || 'Unknown';
}

function getSessionStatusText(status) {
  const code = Number(status);
  if (code === 37) return 'Session returned to patient';
  if (code === 41) return 'Session consumed';
  return 'Session reserved';
}

function buildInfoRows(appt, statusMapping) {
  const parentRate = Number(appt.parentRate) || 0;

  return [
    { label: 'Practitioner', value: appt.practitionerName || 'Admin / Unassigned' },
    { label: 'Service', value: appt.serviceName || 'N/A' },
    { label: 'Date', value: appt.date || 'N/A' },
    { label: 'Time', value: appt.timeSlot || 'N/A' },
    { label: 'Status', value: getStatusLabel(appt.status, statusMapping) },
    {
      label: 'Session Number',
      value: appt.sessionNumber != null ? String(appt.sessionNumber) : '-',
    },
    { label: 'Session Management', value: getSessionStatusText(appt.status) },
    {
      label: 'Parent Rating',
      value: parentRate > 0 ? `${parentRate} / 5` : 'No rating provided',
    },
    {
      label: 'Parent Comment',
      value: appt.parentComment?.trim() || 'No parent comment',
    },
    {
      label: 'Practitioner Comment',
      value: appt.therapistDoctorComment?.trim() || 'No practitioner comment',
    },
  ];
}

export function buildAppointmentDocumentHtml(appt, statusMapping) {
  const t = DOCUMENT_THEME;
  const accentColor = t.greenBright;
  const statusLabel = getStatusLabel(appt.status, statusMapping);
  const infoRows = buildInfoRows(appt, statusMapping);
  const logoUrl = `${window.location.origin}/img/neurspatherapy_logo.png`;

  const metaRows = [
    { label: 'Appointment No', value: formatAppointmentId(appt.id) },
    { label: 'Date', value: appt.date || 'N/A' },
    { label: 'Time', value: appt.timeSlot || 'N/A' },
    { label: 'Generated', value: new Date().toLocaleString('en-MY') },
  ];

  const metaHtml = metaRows
    .map(
      (row) => `
        <div class="meta-row">
          <span class="meta-label">${row.label}</span>
          <span class="meta-value">${escapeHtml(row.value)}</span>
        </div>`,
    )
    .join('');

  const infoHtml = infoRows
    .map(
      (row) => `
        <div class="info-item ${row.label.includes('Comment') ? 'full-width' : ''}">
          <span class="info-label">${row.label}</span>
          <span class="info-value">${escapeHtml(row.value)}</span>
        </div>`,
    )
    .join('');

  const partyLines = [
    appt.patientId ? `Patient ID: ${appt.patientId}` : '',
    appt.isAdminAppointment ? 'Admin placeholder appointment' : '',
  ]
    .filter(Boolean)
    .map((line) => `<div class="party-line">${escapeHtml(line)}</div>`)
    .join('');

  const terms = [
    'Please arrive on time for your scheduled appointment.',
    'Contact the centre if you need to reschedule or cancel.',
    'This is a computer generated appointment summary.',
  ]
    .map((term, index) => `<li>${index + 1}. ${term}</li>`)
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>${formatAppointmentId(appt.id)} - Appointment</title>
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
        .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
        .brand { display: flex; align-items: center; gap: 14px; }
        .brand img { height: 60px; width: auto; }
        .company-name { font-size: 20px; font-weight: 700; color: ${t.greenDark}; margin: 0; }
        .company-address { font-size: 11px; color: ${t.muted}; margin-top: 4px; }
        .doc-head { text-align: right; }
        .doc-type {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: 3px;
          color: ${accentColor};
          margin: 0;
          line-height: 1.1;
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
          background: ${t.green};
        }
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
        .info-panel {
          border: 1px solid ${t.border};
          border-left: 4px solid ${accentColor};
          border-radius: 8px;
          padding: 14px 18px;
          background: #FBFDFB;
          margin-bottom: 18px;
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
          gap: 10px 24px;
        }
        .info-item { display: flex; flex-direction: column; }
        .info-item.full-width { grid-column: 1 / -1; }
        .info-label {
          font-size: 10px;
          text-transform: uppercase;
          color: ${t.muted};
          letter-spacing: 0.5px;
        }
        .info-value {
          font-size: 12.5px;
          font-weight: 600;
          white-space: pre-wrap;
        }
        .terms { margin-top: 24px; border-top: 1px solid ${t.border}; padding-top: 14px; }
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
            <p class="doc-type">APPOINTMENT</p>
            <span class="status-badge">${escapeHtml(statusLabel)}</span>
          </div>
        </div>

        <div class="accent-bar"></div>
        <div class="meta-strip">${metaHtml}</div>

        <div class="party">
          <div class="party-title">Patient</div>
          <div class="party-name">${escapeHtml(appt.patientName || 'N/A')}</div>
          ${partyLines}
        </div>

        <div class="info-panel">
          <div class="info-panel-title">Appointment Details</div>
          <div class="info-grid">${infoHtml}</div>
        </div>

        <div class="terms">
          <div class="terms-title">Notes</div>
          <ul>${terms}</ul>
        </div>

        <div class="footer">
          <p>Generated by <strong>${COMPANY_INFO.name}</strong> via Autibile.</p>
          <p>Generated on ${new Date().toLocaleDateString('en-MY')} · This is a computer generated document.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function renderAppointmentPdf(jsPDF, appt, statusMapping) {
  const t = DOCUMENT_THEME;
  const accent = hexToRgb(t.greenBright);
  const greenDark = hexToRgb(t.greenDark);
  const greenTint = hexToRgb(t.greenTint);
  const ink = hexToRgb(t.ink);
  const muted = hexToRgb(t.muted);
  const border = hexToRgb(t.border);

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

  setText(accent);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.text('APPOINTMENT', rightX, y + 7, { align: 'right' });

  const badgeText = getStatusLabel(appt.status, statusMapping).toUpperCase();
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(8);
  const badgeTextW = pdf.getTextWidth(badgeText);
  const badgeW = badgeTextW + 10;
  const badgeX = rightX - badgeW;
  const badgeY = y + 12;
  setFill(hexToRgb(t.green));
  pdf.roundedRect(badgeX, badgeY, badgeW, 6, 3, 3, 'F');
  setText([255, 255, 255]);
  pdf.text(badgeText, badgeX + badgeW / 2, badgeY + 4.1, { align: 'center' });

  y += 28;
  setFill(accent);
  pdf.rect(marginX, y, contentW, 1.4, 'F');
  y += 8;

  const stripH = 16;
  setFill(greenTint);
  setDraw(border);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(marginX, y, contentW, stripH, 2, 2, 'FD');

  const metaRows = [
    { label: 'APPOINTMENT NO', value: formatAppointmentId(appt.id) },
    { label: 'DATE', value: appt.date || 'N/A' },
    { label: 'TIME', value: appt.timeSlot || 'N/A' },
    { label: 'GENERATED', value: new Date().toLocaleString('en-MY') },
  ];
  const colW = contentW / metaRows.length;
  metaRows.forEach((row, index) => {
    const cx = marginX + index * colW + 4;
    setText(muted);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(7);
    pdf.text(row.label, cx, y + 5.5);
    setText(ink);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(9.5);
    pdf.text(String(row.value), cx, y + 10.5);
  });
  y += stripH + 10;

  setText(accent);
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(8);
  pdf.text('PATIENT', marginX, y);
  y += 5;
  setText(ink);
  pdf.setFontSize(12);
  pdf.text(String(appt.patientName || 'N/A'), marginX, y);
  y += 5;
  if (appt.patientId) {
    setText(muted);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(9);
    pdf.text(`Patient ID: ${appt.patientId}`, marginX, y);
    y += 5;
  }
  y += 6;

  const infoRows = buildInfoRows(appt, statusMapping);
  const panelPadding = 6;
  const estimatedPanelH = 12 + Math.ceil(infoRows.length / 2) * 12 + 8;
  y = ensureSpace(y, estimatedPanelH + 8);
  const panelY = y;

  setDraw(border);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(marginX, panelY, contentW, estimatedPanelH, 2, 2, 'D');
  setFill(accent);
  pdf.rect(marginX, panelY, 1.4, estimatedPanelH, 'F');

  setText(accent);
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(8.5);
  pdf.text('APPOINTMENT DETAILS', marginX + panelPadding, panelY + 7);

  let rowY = panelY + 12;
  infoRows.forEach((row, index) => {
    const col = index % 2;
    const rowIndex = Math.floor(index / 2);
    const ix = marginX + panelPadding + col * (contentW / 2);
    const iy = rowY + rowIndex * 12;
    setText(muted);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(7);
    pdf.text(String(row.label).toUpperCase(), ix, iy);
    setText(ink);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(9);
    const valueLines = pdf.splitTextToSize(String(row.value), contentW / 2 - 8);
    pdf.text(valueLines.slice(0, 3), ix, iy + 4);
  });

  y = panelY + estimatedPanelH + 12;

  const terms = [
    'Please arrive on time for your scheduled appointment.',
    'Contact the centre if you need to reschedule or cancel.',
    'This is a computer generated appointment summary.',
  ];
  y = ensureSpace(y, 12 + terms.length * 4);
  setDraw(border);
  pdf.setLineWidth(0.3);
  pdf.line(marginX, y, rightX, y);
  y += 6;
  setText(accent);
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(8);
  pdf.text('NOTES', marginX, y);
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

  y = ensureSpace(y, 18);
  setDraw(accent);
  pdf.setLineWidth(0.6);
  pdf.line(marginX, y, rightX, y);
  y += 6;
  setText(greenDark);
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(9);
  pdf.text(`Generated by ${COMPANY_INFO.name} via Autibile.`, pageWidth / 2, y, { align: 'center' });
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
}

export function buildAppointmentPdfFilename(appt) {
  const safePatient = (appt?.patientName || 'Patient')
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_');
  return `Appointment_${formatAppointmentId(appt.id)}_${safePatient}_${new Date().toISOString().slice(0, 10)}.pdf`;
}
