import {
  COMPANY_INFO,
  DOCUMENT_THEME,
} from '~/utils/paymentDocuments';
import {
  DIARY_CATEGORIES,
  OPTIONAL_NOTES_LABEL,
  getDiaryEntryLines,
  isLegacyDiaryEntry,
} from '~/utils/diaryReport';

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

export function formatReportDate(value) {
  return new Date(value).toLocaleDateString('en-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatReportTime(value) {
  return new Date(value).toLocaleTimeString('en-MY', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getEntryFields(entry) {
  if (isLegacyDiaryEntry(entry)) {
    return [{ label: 'Report', value: entry.description.trim(), fullWidth: true }];
  }

  const fields = DIARY_CATEGORIES.map(({ key, label }) => {
    const value = entry?.[key]?.trim?.();
    if (!value) return null;
    return { label, value, fullWidth: false };
  }).filter(Boolean);

  if (entry?.description?.trim?.()) {
    fields.push({
      label: OPTIONAL_NOTES_LABEL,
      value: entry.description.trim(),
      fullWidth: true,
    });
  }

  if (fields.length > 0) return fields;

  return getDiaryEntryLines(entry).map((line) => ({
    label: line.label,
    value: line.value,
    fullWidth: true,
  }));
}

export function groupDiaryEntriesByDate(entries) {
  const grouped = entries.reduce((acc, entry) => {
    const timestamp = entry.timestamp || entry.created_at;
    const dateKey = new Date(timestamp).toDateString();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push({ ...entry, timestamp });
    return acc;
  }, {});

  return Object.entries(grouped).sort(
    ([a], [b]) => new Date(b).getTime() - new Date(a).getTime(),
  );
}

export function buildDiaryReportFilename(childName, forAllEntries = true, selectedDate = null) {
  const safeChild = (childName || 'Child')
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10);

  if (!forAllEntries && selectedDate) {
    const safeDate = selectedDate.replace(/\s/g, '_');
    return `Diary_Report_${safeChild}_${safeDate}.pdf`;
  }

  return `Diary_Report_${safeChild}_${stamp}.pdf`;
}

export async function renderDiaryReportPdf(jsPDF, options) {
  const {
    title = 'Patient Diary Report',
    childName,
    childNickname,
    entries = [],
    reportScope = 'all',
    selectedDate = null,
  } = options;

  const t = DOCUMENT_THEME;
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 16;
  const rightX = pageWidth - marginX;
  const contentW = pageWidth - marginX * 2;
  const bottomLimit = pageHeight - 14;
  const generatedAt = new Date();

  const accent = hexToRgb(t.greenBright);
  const green = hexToRgb(t.green);
  const greenDark = hexToRgb(t.greenDark);
  const greenTint = hexToRgb(t.greenTint);
  const ink = hexToRgb(t.ink);
  const muted = hexToRgb(t.muted);
  const border = hexToRgb(t.border);

  let y = 16;

  const setFill = (c) => pdf.setFillColor(c[0], c[1], c[2]);
  const setText = (c) => pdf.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c) => pdf.setDrawColor(c[0], c[1], c[2]);

  const ensureSpace = (needed) => {
    if (y + needed > bottomLimit) {
      pdf.addPage();
      y = 18;
    }
  };

  // — Header
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
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(18);
  pdf.text('DIARY REPORT', rightX, y + 7, { align: 'right' });
  setText(muted);
  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(9);
  pdf.text(String(title), rightX, y + 13, { align: 'right' });

  const badge = 'PATIENT RECORD';
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(8);
  const badgeW = pdf.getTextWidth(badge) + 10;
  const badgeX = rightX - badgeW;
  const badgeY = y + 16;
  setFill(green);
  pdf.roundedRect(badgeX, badgeY, badgeW, 6, 3, 3, 'F');
  setText([255, 255, 255]);
  pdf.text(badge, badgeX + badgeW / 2, badgeY + 4.1, { align: 'center' });

  y += 28;
  setFill(accent);
  pdf.rect(marginX, y, contentW, 1.4, 'F');
  y += 8;

  // — Meta strip
  const childLabel = [childName, childNickname ? `(${childNickname})` : '']
    .filter(Boolean)
    .join(' ')
    .trim() || 'N/A';

  const metaRows = [
    { label: 'Child', value: childLabel },
    {
      label: 'Report Scope',
      value: reportScope === 'date' && selectedDate
        ? formatReportDate(selectedDate)
        : 'All diary entries',
    },
    { label: 'Total Entries', value: String(entries.length) },
    { label: 'Generated', value: generatedAt.toLocaleString('en-MY') },
  ];

  const stripH = 16;
  ensureSpace(stripH + 4);
  setFill(greenTint);
  setDraw(border);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(marginX, y, contentW, stripH, 2, 2, 'FD');

  const colW = contentW / metaRows.length;
  metaRows.forEach((row, index) => {
    const cx = marginX + index * colW + 4;
    setText(muted);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(7);
    pdf.text(String(row.label).toUpperCase(), cx, y + 5.5);
    setText(ink);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(9);
    const valueLines = pdf.splitTextToSize(String(row.value ?? 'N/A'), colW - 8);
    pdf.text(valueLines.slice(0, 2), cx, y + 10.5);
  });
  y += stripH + 10;

  // — Prepared for
  if (childLabel && childLabel !== 'N/A') {
    ensureSpace(12);
    setText(accent);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(8);
    pdf.text('PREPARED FOR', marginX, y);
    y += 5;
    setText(ink);
    pdf.setFontSize(12);
    pdf.text(childLabel, marginX, y);
    y += 10;
  }

  const drawField = (field, x, fieldY, maxW) => {
    setText(accent);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(7);
    const label = field.label ? String(field.label).toUpperCase() : '';
    if (label) pdf.text(label, x, fieldY);

    setText(ink);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(9);
    const valueLines = pdf.splitTextToSize(String(field.value ?? '—'), maxW);
    pdf.text(valueLines, x, fieldY + (label ? 4 : 0));
    return valueLines.length * 4 + (label ? 5 : 0);
  };

  const measureFieldHeight = (field, maxW) => {
    const valueLines = pdf.splitTextToSize(String(field.value ?? '—'), maxW);
    return valueLines.length * 4 + (field.label ? 5 : 0) + 4;
  };

  const drawEntryCard = (entry, entryIndex) => {
    const fields = getEntryFields(entry);
    const timestamp = entry.timestamp || entry.created_at;
    const colW = (contentW - 12) / 2;
    const leftX = marginX + 6;
    const rightXCol = marginX + 6 + colW + 6;

    let bodyHeight = 0;
    let index = 0;
    while (index < fields.length) {
      const field = fields[index];
      if (field.fullWidth || !field.label) {
        bodyHeight += measureFieldHeight(field, contentW - 12);
        index += 1;
        continue;
      }

      const next = fields[index + 1];
      if (next && !next.fullWidth && next.label) {
        bodyHeight += Math.max(
          measureFieldHeight(field, colW),
          measureFieldHeight(next, colW),
        );
        index += 2;
      } else {
        bodyHeight += measureFieldHeight(field, colW);
        index += 1;
      }
    }

    const cardH = Math.max(bodyHeight, 8) + 16;
    ensureSpace(cardH + 4);

    const cardY = y;
    setDraw(border);
    pdf.setLineWidth(0.3);
    pdf.setFillColor(251, 253, 251);
    pdf.roundedRect(marginX, cardY, contentW, cardH, 2.5, 2.5, 'FD');

    setFill(accent);
    const badgeLabel = `ENTRY ${entryIndex + 1}`;
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(7);
    const entryBadgeW = pdf.getTextWidth(badgeLabel) + 8;
    pdf.roundedRect(marginX + 6, cardY + 5, entryBadgeW, 5, 2.5, 2.5, 'F');
    setText([255, 255, 255]);
    pdf.text(badgeLabel, marginX + 6 + entryBadgeW / 2, cardY + 8.5, { align: 'center' });

    setText(muted);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(8);
    pdf.text(formatReportTime(timestamp), rightX - 6, cardY + 8.5, { align: 'right' });

    setDraw(border);
    pdf.setLineWidth(0.2);
    pdf.line(marginX + 6, cardY + 12, rightX - 6, cardY + 12);

    let fieldY = cardY + 16;
    index = 0;
    while (index < fields.length) {
      const field = fields[index];
      if (field.fullWidth || !field.label) {
        const h = drawField(field, leftX, fieldY, contentW - 12);
        fieldY += h + 2;
        index += 1;
        continue;
      }

      const next = fields[index + 1];
      if (next && !next.fullWidth && next.label) {
        const leftH = drawField(field, leftX, fieldY, colW);
        const rightH = drawField(next, rightXCol, fieldY, colW);
        fieldY += Math.max(leftH, rightH) + 2;
        index += 2;
      } else {
        const h = drawField(field, leftX, fieldY, colW);
        fieldY += h + 2;
        index += 1;
      }
    }

    y = cardY + cardH + 4;
  };

  const drawDateSection = (dateKey, dayEntries) => {
    ensureSpace(14);
    const titleH = 9;
    setFill(greenTint);
    setFill(accent);
    pdf.rect(marginX, y, 1.4, titleH, 'F');
    setFill(greenTint);
    pdf.rect(marginX + 1.4, y, contentW - 1.4, titleH, 'F');
    setText(greenDark);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(9);
    pdf.text(formatReportDate(dateKey).toUpperCase(), marginX + 5, y + 6);
    y += titleH + 4;

    dayEntries.forEach((entry, index) => {
      drawEntryCard(entry, index);
    });
    y += 4;
  };

  const grouped = groupDiaryEntriesByDate(entries);

  if (grouped.length === 0) {
    ensureSpace(10);
    setText(muted);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(10);
    pdf.text('No diary entries available.', marginX, y);
    y += 8;
  } else {
    grouped.forEach(([dateKey, dayEntries]) => {
      drawDateSection(dateKey, dayEntries);
    });
  }

  // — Notes
  const terms = [
    'This report summarises diary observations recorded in Autibile.',
    'Please retain this document for your personal records and therapy discussions.',
    'This is a computer generated report.',
  ];

  ensureSpace(28);
  y += 6;
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
  pdf.setFontSize(8.5);
  terms.forEach((term, index) => {
    ensureSpace(5);
    pdf.text(`${index + 1}. ${term}`, marginX, y);
    y += 4.5;
  });

  // — Footer
  ensureSpace(16);
  y += 4;
  setDraw(accent);
  pdf.setLineWidth(0.6);
  pdf.line(marginX, y, rightX, y);
  y += 6;
  setText(muted);
  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(8.5);
  pdf.text(`Generated by ${COMPANY_INFO.name} via Autibile.`, pageWidth / 2, y, { align: 'center' });
  y += 4;
  pdf.text(
    `Generated on ${generatedAt.toLocaleDateString('en-MY')} · This is a computer generated document.`,
    pageWidth / 2,
    y,
    { align: 'center' },
  );

  return pdf;
}

export async function downloadDiaryReportPdf(options) {
  const { default: jsPDF } = await import('jspdf');
  const pdf = await renderDiaryReportPdf(jsPDF, options);
  const filename = buildDiaryReportFilename(
    options.childName,
    options.reportScope !== 'date',
    options.selectedDate,
  );
  pdf.save(filename);
  return pdf;
}
