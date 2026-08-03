import { COMPANY_INFO, DOCUMENT_THEME, openPrintWindow } from './paymentDocuments';

const THEME = DOCUMENT_THEME;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

function getLogoUrl() {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/img/neurspatherapy_logo.png`;
  }
  return '/img/neurspatherapy_logo.png';
}

function buildDocumentStyles() {
  return `
    * { box-sizing: border-box; }
    @page { margin: 16mm; size: A4; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      color: ${THEME.ink};
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .doc { max-width: 780px; margin: 0 auto; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand img { height: 60px; width: auto; }
    .company-name { font-size: 20px; font-weight: 700; color: ${THEME.greenDark}; margin: 0; }
    .company-address { font-size: 11px; color: ${THEME.muted}; margin-top: 4px; }
    .doc-head { text-align: right; }
    .doc-type {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 2px;
      color: ${THEME.greenBright};
      margin: 0;
      line-height: 1.1;
    }
    .doc-subtitle { margin-top: 6px; font-size: 12px; color: ${THEME.muted}; }
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
      background: ${THEME.green};
    }
    .accent-bar {
      height: 4px;
      background: linear-gradient(90deg, ${THEME.greenDark}, ${THEME.greenBright});
      border-radius: 2px;
      margin: 16px 0 20px;
    }
    .meta-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 40px;
      background: ${THEME.greenTint};
      border: 1px solid ${THEME.border};
      border-radius: 8px;
      padding: 12px 18px;
      margin-bottom: 22px;
    }
    .meta-row { display: flex; flex-direction: column; min-width: 140px; }
    .meta-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: ${THEME.muted};
    }
    .meta-value { font-size: 13px; font-weight: 600; color: ${THEME.ink}; }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: ${THEME.greenBright};
      text-transform: uppercase;
      margin: 0 0 10px 0;
    }
    .info-panel {
      border: 1px solid ${THEME.border};
      border-left: 4px solid ${THEME.greenBright};
      border-radius: 8px;
      padding: 14px 18px;
      background: #FBFDFB;
      margin-bottom: 18px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 24px;
    }
    .info-item { display: flex; flex-direction: column; gap: 4px; }
    .info-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: ${THEME.muted};
      font-weight: 700;
    }
    .info-value { font-size: 12.5px; font-weight: 600; color: ${THEME.ink}; }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
      font-size: 11.5px;
    }
    .summary-table thead th {
      background: ${THEME.greenBright};
      color: #fff;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: left;
      padding: 10px 12px;
    }
    .summary-table tbody td {
      padding: 10px 12px;
      border-bottom: 1px solid ${THEME.border};
      vertical-align: top;
    }
    .summary-table tbody tr:nth-child(even) { background: ${THEME.greenTint}; }
    .domain-section {
      margin: 0 0 12px 0;
      padding: 12px 14px;
      background: #FBFDFB;
      border: 1px solid ${THEME.border};
      border-left: 4px solid ${THEME.greenBright};
      border-radius: 8px;
    }
    .domain-section h3 {
      margin: 0 0 8px 0;
      font-size: 12px;
      color: ${THEME.greenDark};
      font-weight: 700;
    }
    .domain-section ul { margin: 0; padding-left: 18px; }
    .domain-section li { margin: 4px 0; font-size: 11.5px; }
    .domain-section p { margin: 0; font-size: 11.5px; color: ${THEME.muted}; }
    .highlight { font-weight: 700; color: #B45309; }
    .score-panel {
      text-align: center;
      background: ${THEME.greenTint};
      border: 1px solid ${THEME.border};
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .score-label { font-size: 12px; color: ${THEME.muted}; margin: 0; }
    .score-number {
      font-size: 34px;
      font-weight: 800;
      color: ${THEME.greenDark};
      margin: 6px 0 0 0;
    }
    .content-panel {
      border: 1px solid ${THEME.border};
      border-left: 4px solid ${THEME.greenBright};
      border-radius: 8px;
      padding: 14px 16px;
      background: #fff;
      margin-bottom: 14px;
    }
    .content-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      color: ${THEME.greenBright};
      margin-bottom: 8px;
    }
    .content-text { font-size: 12px; color: ${THEME.ink}; margin: 0 0 6px 0; line-height: 1.5; }
    .content-text-muted { font-size: 12px; color: ${THEME.muted}; font-style: italic; }
    .divider { height: 1px; background: ${THEME.border}; margin: 10px 0; }
    .ai-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      color: ${THEME.muted};
      margin-bottom: 4px;
    }
    .next-steps {
      background: ${THEME.greenTint};
      border: 1px solid ${THEME.border};
      border-left: 4px solid ${THEME.greenDark};
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 14px;
      font-size: 12px;
      color: ${THEME.greenDark};
    }
    .notes-panel {
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      border-left: 4px solid #F59E0B;
      border-radius: 8px;
      padding: 14px 16px;
      margin: 18px 0;
    }
    .notes-panel h4 {
      margin: 0 0 8px 0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      color: #92400E;
    }
    .notes-panel ul { margin: 0; padding-left: 18px; }
    .notes-panel li { margin: 4px 0; font-size: 11px; color: #92400E; }
    .assessor-panel {
      border: 1px solid ${THEME.border};
      border-radius: 8px;
      padding: 14px 16px;
      margin-top: 18px;
    }
    .assessor-panel h4 {
      margin: 0 0 10px 0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      color: ${THEME.greenBright};
    }
    .assessor-line { margin: 8px 0; font-size: 11.5px; color: ${THEME.ink}; }
    .signature-line {
      display: inline-block;
      min-width: 160px;
      border-bottom: 1px solid ${THEME.ink};
      margin-left: 6px;
    }
    .footer {
      text-align: center;
      margin-top: 22px;
      padding-top: 12px;
      border-top: 2px solid ${THEME.greenBright};
      font-size: 11px;
      color: ${THEME.muted};
    }
    .footer strong { color: ${THEME.greenDark}; }
  `;
}

function buildHeaderHtml(docType, subtitle, badgeText) {
  const logoUrl = getLogoUrl();
  return `
    <div class="top">
      <div class="brand">
        <img src="${logoUrl}" alt="${COMPANY_INFO.name} logo" />
        <div>
          <p class="company-name">${COMPANY_INFO.name}</p>
          <div class="company-address">${COMPANY_INFO.addressLines.join('<br>')}</div>
        </div>
      </div>
      <div class="doc-head">
        <p class="doc-type">${escapeHtml(docType)}</p>
        <p class="doc-subtitle">${escapeHtml(subtitle)}</p>
        <span class="status-badge">${escapeHtml(badgeText)}</span>
      </div>
    </div>
    <div class="accent-bar"></div>
  `;
}

function buildMetaStripHtml(rows) {
  return `
    <div class="meta-strip">
      ${rows
        .map(
          (row) => `
        <div class="meta-row">
          <span class="meta-label">${escapeHtml(row.label)}</span>
          <span class="meta-value">${escapeHtml(row.value)}</span>
        </div>`,
        )
        .join('')}
    </div>`;
}

function buildNotesHtml() {
  return `
    <div class="notes-panel">
      <h4>Important Notes</h4>
      <ul>
        <li>This screening is not a diagnosis</li>
        <li>Further clinical evaluation may be required</li>
        <li>Early intervention improves outcomes</li>
      </ul>
    </div>`;
}

function buildFooterHtml() {
  const generatedOn = new Date().toLocaleDateString('en-MY');
  return `
    <div class="footer">
      <p>This report is confidential and intended for the parent/guardian and authorized healthcare providers only.</p>
      <p>Generated by <strong>${COMPANY_INFO.name}</strong> via Autibile on ${generatedOn}.</p>
    </div>`;
}

export function resolveScoreInterpretation(score, thresholds = []) {
  const numericScore = parseInt(score, 10);
  if (Number.isNaN(numericScore)) return null;
  return (
    thresholds.find(
      (t) => numericScore >= t.scoring_min && numericScore <= t.scoring_max,
    ) || null
  );
}

export function findMostRecentByQuestionnaireId(responses, questionnaireId) {
  const matches = responses.filter((r) => r.questionnaire_id === questionnaireId);
  if (!matches.length) return null;
  return matches.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];
}

export function findMostRecentByKeywords(responses, keywords) {
  const matches = responses.filter((r) =>
    keywords.some((kw) =>
      r.questionnaire_title?.toLowerCase().includes(kw.toLowerCase()),
    ),
  );
  if (!matches.length) return null;
  return matches.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];
}

export function buildMchatDetailedHtml(mchatScore) {
  const score =
    typeof mchatScore === 'number' ? mchatScore : parseInt(String(mchatScore), 10);
  let items = '';

  if (Number.isNaN(score)) {
    items = '<li>Score not available.</li>';
  } else if (score <= 2) {
    items =
      '<li><span class="highlight">LOW RISK.</span> If child is under 2 years old, repeat after 2 years old. No further action is required unless surveillance indicates likelihood for autism.</li>';
  } else if (score >= 3 && score <= 7) {
    items =
      '<li><span class="highlight">MODERATE RISK.</span> Please arrange a face-to-face consultation to continue with the M-CHAT-R Follow-Up Interview.</li>';
  } else if (score >= 8) {
    items =
      '<li><span class="highlight">HIGH RISK.</span> Proceed to diagnostic evaluation. Highly recommended for early intervention.</li>';
  }

  return `
    <div class="domain-section">
      <h3>Autism Screening (M-CHAT-R) [Score: ${escapeHtml(String(mchatScore))} / 20]</h3>
      <ul>${items}</ul>
    </div>`;
}

export function buildBambiDetailedHtml(bambiScore) {
  if (bambiScore === 'N/A') {
    return `
      <div class="domain-section">
        <h3>Feeding (BAMBI) [Not assessed]</h3>
        <p>Not assessed — no screening completed</p>
      </div>`;
  }

  const score =
    typeof bambiScore === 'number' ? bambiScore : parseInt(String(bambiScore), 10);
  const riskText =
    !Number.isNaN(score) && score <= 34
      ? '<span class="highlight">Within typical limits.</span>'
      : '<span class="highlight">Feeding concerns.</span>';

  return `
    <div class="domain-section">
      <h3>Feeding (BAMBI) [Score: ${escapeHtml(String(bambiScore))}]</h3>
      <ul>
        <li>${riskText}</li>
        <li>Recommendation: Refer if clinically indicated.</li>
      </ul>
    </div>`;
}

export function buildSleepDetailedHtml(sleepScore) {
  if (sleepScore === 'N/A') {
    return `
      <div class="domain-section">
        <h3>Sleep (CSHQ-SF) [Not assessed]</h3>
        <p>Not assessed — no screening completed</p>
      </div>`;
  }

  const score =
    typeof sleepScore === 'number' ? sleepScore : parseInt(String(sleepScore), 10);
  const riskText =
    !Number.isNaN(score) && score >= 30
      ? '<span class="highlight">Risk for sleep problems.</span>'
      : '<span class="highlight">Low risk.</span>';

  return `
    <div class="domain-section">
      <h3>Sleep (CSHQ-SF) [Score: ${escapeHtml(String(sleepScore))}]</h3>
      <ul>
        <li>${riskText}</li>
        <li>Recommendation: Maintain sleep hygiene or assess.</li>
      </ul>
    </div>`;
}

export function buildScreenDetailedHtml(
  screenScore,
  screenInterpretation,
  screenRecommendation,
) {
  if (screenScore === 'N/A') {
    return `
      <div class="domain-section">
        <h3>Screen Time (SEQ) [Not assessed]</h3>
        <p>Not assessed — no screening completed</p>
      </div>`;
  }

  let items = '';
  if (screenInterpretation && screenInterpretation !== 'Not assessed') {
    items += `<li><span class="highlight">${escapeHtml(screenInterpretation)}</span></li>`;
  } else {
    items += '<li>Score recorded.</li>';
  }
  if (screenRecommendation) {
    items += `<li>Recommendation: ${escapeHtml(screenRecommendation)}</li>`;
  }

  return `
    <div class="domain-section">
      <h3>Screen Time (SEQ) [Score: ${escapeHtml(String(screenScore))}]</h3>
      <ul>${items}</ul>
    </div>`;
}

function getMchatDomainSection(mchatScore) {
  const score =
    typeof mchatScore === 'number' ? mchatScore : parseInt(String(mchatScore), 10);
  const title = `Autism Screening (M-CHAT-R) [Score: ${mchatScore} / 20]`;
  if (Number.isNaN(score)) return { title, lines: ['Score not available.'] };
  if (score <= 2) {
    return {
      title,
      lines: [
        'LOW RISK. If child is under 2 years old, repeat after 2 years old. No further action is required unless surveillance indicates likelihood for autism.',
      ],
    };
  }
  if (score >= 3 && score <= 7) {
    return {
      title,
      lines: [
        'MODERATE RISK. Please arrange a face-to-face consultation to continue with the M-CHAT-R Follow-Up Interview.',
      ],
    };
  }
  return {
    title,
    lines: [
      'HIGH RISK. Proceed to diagnostic evaluation. Highly recommended for early intervention.',
    ],
  };
}

function getBambiDomainSection(bambiScore) {
  if (bambiScore === 'N/A') {
    return {
      title: 'Feeding (BAMBI) [Not assessed]',
      lines: ['Not assessed — no screening completed'],
    };
  }
  const score =
    typeof bambiScore === 'number' ? bambiScore : parseInt(String(bambiScore), 10);
  return {
    title: `Feeding (BAMBI) [Score: ${bambiScore}]`,
    lines: [
      !Number.isNaN(score) && score <= 34
        ? 'Within typical limits.'
        : 'Feeding concerns.',
      'Recommendation: Refer if clinically indicated.',
    ],
  };
}

function getSleepDomainSection(sleepScore) {
  if (sleepScore === 'N/A') {
    return {
      title: 'Sleep (CSHQ-SF) [Not assessed]',
      lines: ['Not assessed — no screening completed'],
    };
  }
  const score =
    typeof sleepScore === 'number' ? sleepScore : parseInt(String(sleepScore), 10);
  return {
    title: `Sleep (CSHQ-SF) [Score: ${sleepScore}]`,
    lines: [
      !Number.isNaN(score) && score >= 30
        ? 'Risk for sleep problems.'
        : 'Low risk.',
      'Recommendation: Maintain sleep hygiene or assess.',
    ],
  };
}

function getScreenDomainSection(screenScore, screenInterpretation, screenRecommendation) {
  if (screenScore === 'N/A') {
    return {
      title: 'Screen Time (SEQ) [Not assessed]',
      lines: ['Not assessed — no screening completed'],
    };
  }
  const lines = [];
  if (screenInterpretation && screenInterpretation !== 'Not assessed') {
    lines.push(screenInterpretation);
  } else {
    lines.push('Score recorded.');
  }
  if (screenRecommendation) {
    lines.push(`Recommendation: ${screenRecommendation}`);
  }
  return {
    title: `Screen Time (SEQ) [Score: ${screenScore}]`,
    lines,
  };
}

function formatReportDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-MY', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return 'N/A';
  }
}

function calculateAgeYears(dob) {
  if (!dob) return 'N/A';
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return 'N/A';
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return String(age);
}

export function buildIntegratedReportOptions({
  responses,
  thresholdsByQid,
  patientDetails,
  parentDetails,
}) {
  const mchatResponse = findMostRecentByQuestionnaireId(responses, 1);
  if (!mchatResponse) return null;

  const bambiResponse = findMostRecentByKeywords(responses, ['meal', 'bambi', 'feeding']);
  const sleepResponse = findMostRecentByKeywords(responses, ['sleep', 'cshq']);
  const screenResponse = findMostRecentByKeywords(responses, ['screen', 'seq']);

  const getInterpretation = (response) => {
    if (!response) return 'Not assessed';
    const band = resolveScoreInterpretation(
      response.total_score,
      thresholdsByQid[response.questionnaire_id] || [],
    );
    return band?.interpretation || 'Not assessed';
  };

  const getRecommendation = (response) => {
    if (!response) return '';
    const band = resolveScoreInterpretation(
      response.total_score,
      thresholdsByQid[response.questionnaire_id] || [],
    );
    return band?.recommendation || '';
  };

  const mchatScore = mchatResponse.total_score ?? 'N/A';
  const bambiScore = bambiResponse?.total_score ?? 'N/A';
  const sleepScore = sleepResponse?.total_score ?? 'N/A';
  const screenScore = screenResponse?.total_score ?? 'N/A';
  const screenInterpretation = getInterpretation(screenResponse);
  const screenRecommendation = getRecommendation(screenResponse);

  return {
    childName: patientDetails?.fullname || mchatResponse.patient_name || 'N/A',
    childDOB: formatReportDate(patientDetails?.dob),
    childAge: patientDetails?.dob ? calculateAgeYears(patientDetails.dob) : 'N/A',
    childGender: patientDetails?.gender || 'N/A',
    screeningDate: formatReportDate(mchatResponse.created_at),
    parentName: parentDetails?.fullName || 'N/A',
    parentRelationship: parentDetails?.relationship || 'N/A',
    summaryRows: [
      {
        domain: 'Autism (M-CHAT-R)',
        score: `${mchatScore}/20`,
        interpretation: getInterpretation(mchatResponse),
      },
      {
        domain: 'Feeding (BAMBI)',
        score: String(bambiScore),
        interpretation: getInterpretation(bambiResponse),
      },
      {
        domain: 'Sleep (CSHQ-SF)',
        score: String(sleepScore),
        interpretation: getInterpretation(sleepResponse),
      },
      {
        domain: 'Screen Time (SEQ)',
        score: String(screenScore),
        interpretation: getInterpretation(screenResponse),
      },
    ],
    domainSections: [
      getMchatDomainSection(mchatScore),
      getBambiDomainSection(bambiScore),
      getSleepDomainSection(sleepScore),
      getScreenDomainSection(screenScore, screenInterpretation, screenRecommendation),
    ],
    detailedSectionsHtml: [
      buildMchatDetailedHtml(mchatScore),
      buildBambiDetailedHtml(bambiScore),
      buildSleepDetailedHtml(sleepScore),
      buildScreenDetailedHtml(screenScore, screenInterpretation, screenRecommendation),
    ].join(''),
  };
}

export function buildIntegratedScreeningReportHtml(data) {
  const generatedAt = new Date().toLocaleString('en-MY');
  const summaryRowsHtml = data.summaryRows
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.domain)}</td>
        <td>${escapeHtml(row.score)}</td>
        <td>${escapeHtml(row.interpretation)}</td>
      </tr>`,
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Integrated Developmental Screening Report</title>
      <style>${buildDocumentStyles()}</style>
    </head>
    <body>
      <div class="doc">
        ${buildHeaderHtml(
          'SCREENING REPORT',
          'Integrated Developmental Screening Report',
          'Multi-Domain',
        )}
        ${buildMetaStripHtml([
          { label: 'Report Generated', value: generatedAt },
          { label: 'Report Type', value: 'Integrated Developmental Screening' },
          { label: 'Screening Date', value: data.screeningDate },
        ])}

        <div class="info-panel">
          <div class="section-title">Child Information</div>
          <div class="info-grid">
            <div class="info-item"><span class="info-label">Child's Name</span><span class="info-value">${escapeHtml(data.childName)}</span></div>
            <div class="info-item"><span class="info-label">Age at Screening</span><span class="info-value">${escapeHtml(data.childAge)}</span></div>
            <div class="info-item"><span class="info-label">Date of Birth</span><span class="info-value">${escapeHtml(data.childDOB)}</span></div>
            <div class="info-item"><span class="info-label">Gender</span><span class="info-value">${escapeHtml(data.childGender)}</span></div>
          </div>
        </div>

        <div class="info-panel">
          <div class="section-title">Parent / Caregiver Information</div>
          <div class="info-grid">
            <div class="info-item"><span class="info-label">Name</span><span class="info-value">${escapeHtml(data.parentName)}</span></div>
            <div class="info-item"><span class="info-label">Relationship to Child</span><span class="info-value">${escapeHtml(data.parentRelationship)}</span></div>
          </div>
        </div>

        <div class="section-title">Summary Table</div>
        <table class="summary-table">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Score</th>
              <th>Interpretation</th>
            </tr>
          </thead>
          <tbody>${summaryRowsHtml}</tbody>
        </table>

        <div class="section-title">Detailed Scoring Breakdowns</div>
        ${data.detailedSectionsHtml}

        ${buildNotesHtml()}

        <div class="assessor-panel">
          <h4>Assessor's Information</h4>
          <p class="assessor-line"><strong>Name:</strong><span class="signature-line"></span></p>
          <p class="assessor-line"><strong>Designation:</strong><span class="signature-line"></span></p>
          <p class="assessor-line"><strong>Institution:</strong><span class="signature-line"></span></p>
          <p class="assessor-line"><strong>Signature:</strong><span class="signature-line"></span></p>
          <p class="assessor-line"><strong>Date:</strong><span class="signature-line"></span></p>
        </div>

        ${buildFooterHtml()}
      </div>
    </body>
    </html>
  `;
}

export function buildIndividualReportOptions(response, thresholds = []) {
  const band = resolveScoreInterpretation(response.total_score, thresholds);
  return {
    questionnaireTitle: response.questionnaire_title || 'Screening',
    childName: response.patient_name || 'N/A',
    patientId: response.patient_id,
    score: response.total_score ?? 0,
    interpretation: band?.interpretation,
    interpretation_bm: band?.interpretation_bm,
    recommendation: band?.recommendation,
    recommendation_bm: band?.recommendation_bm,
    aiAnalysis: response.ai_analysis || null,
    showMchatFollowUp:
      response.questionnaire_id === 1 &&
      response.total_score >= 3 &&
      response.total_score <= 7,
  };
}

export function buildIndividualScreeningResultHtml(data) {
  const generatedAt = new Date().toLocaleString('en-MY');

  const interpretationHtml =
    data.interpretation && data.interpretation !== 'No prediction available'
      ? `<p class="content-text"><strong>Based on Score (${escapeHtml(String(data.score))}):</strong> ${escapeHtml(data.interpretation)}</p>`
      : '';
  const interpretationBmHtml = data.interpretation_bm
    ? `<p class="content-text-muted">${escapeHtml(data.interpretation_bm)}</p>`
    : '';
  const aiExplanationHtml = data.aiAnalysis?.explanation
    ? `<div class="divider"></div><div class="ai-label">AI Analysis</div><p class="content-text">${escapeHtml(data.aiAnalysis.explanation)}</p>`
    : '';

  const recommendationHtml =
    data.recommendation && data.recommendation !== 'No recommendation available'
      ? `<p class="content-text">${escapeHtml(data.recommendation)}</p>`
      : '';
  const recommendationBmHtml = data.recommendation_bm
    ? `<p class="content-text-muted">${escapeHtml(data.recommendation_bm)}</p>`
    : '';
  const aiRecommendationHtml = data.aiAnalysis?.result
    ? `<div class="divider"></div><div class="ai-label">AI Recommendation</div><p class="content-text">${escapeHtml(data.aiAnalysis.result)}</p>`
    : '';

  const followUpHtml = data.showMchatFollowUp
    ? `<div class="next-steps"><strong>Next Steps:</strong> Based on your score, the patient needs to take the next level questionnaire (M-CHAT-R/F). Please contact our administrator for the next process.</div>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(data.questionnaireTitle)} Screening Result</title>
      <style>${buildDocumentStyles()}</style>
    </head>
    <body>
      <div class="doc">
        ${buildHeaderHtml(
          'SCREENING RESULT',
          `${data.questionnaireTitle} Assessment`,
          'Individual Report',
        )}
        ${buildMetaStripHtml([
          { label: 'Report Generated', value: generatedAt },
          { label: 'Assessment', value: data.questionnaireTitle },
          { label: 'Patient ID', value: String(data.patientId ?? 'N/A') },
        ])}

        <div class="info-panel">
          <div class="section-title">Child Information</div>
          <div class="info-grid">
            <div class="info-item"><span class="info-label">Child's Name</span><span class="info-value">${escapeHtml(data.childName)}</span></div>
            <div class="info-item"><span class="info-label">Patient ID</span><span class="info-value">${escapeHtml(String(data.patientId ?? 'N/A'))}</span></div>
          </div>
        </div>

        <div class="score-panel">
          <p class="score-label">Total Score</p>
          <p class="score-number">${escapeHtml(String(data.score))}</p>
        </div>

        <div class="content-panel">
          <div class="content-label">Prediction</div>
          ${interpretationHtml}
          ${interpretationBmHtml}
          ${aiExplanationHtml}
        </div>

        <div class="content-panel">
          <div class="content-label">Recommendation</div>
          ${recommendationHtml}
          ${recommendationBmHtml}
          ${aiRecommendationHtml}
        </div>

        ${followUpHtml}
        ${buildNotesHtml()}
        ${buildFooterHtml()}
      </div>
    </body>
    </html>
  `;
}

export function buildIntegratedReportFilename(childName) {
  const safeChild = String(childName || 'Patient')
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_');
  return `Integrated_Screening_${safeChild}_${new Date().toISOString().slice(0, 10)}.pdf`;
}

export function buildIndividualResultFilename(questionnaireTitle, childName) {
  const safeTitle = String(questionnaireTitle || 'Screening')
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_');
  const safeChild = String(childName || 'Patient')
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_');
  return `${safeTitle}_Result_${safeChild}_${new Date().toISOString().slice(0, 10)}.pdf`;
}

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

function createPdfRenderer(jsPDF) {
  const t = DOCUMENT_THEME;
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 16;
  const rightX = pageWidth - marginX;
  const contentW = pageWidth - marginX * 2;
  const bottomLimit = pageHeight - 14;

  const accent = hexToRgb(t.greenBright);
  const greenDark = hexToRgb(t.greenDark);
  const greenTint = hexToRgb(t.greenTint);
  const ink = hexToRgb(t.ink);
  const muted = hexToRgb(t.muted);
  const border = hexToRgb(t.border);
  const warnBg = hexToRgb('#FFFBEB');
  const warnBorder = hexToRgb('#F59E0B');

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

  async function drawBrandHeader(docType, badgeText) {
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
    pdf.text(docType, rightX, y + 7, { align: 'right' });

    const badge = String(badgeText || '').toUpperCase();
    pdf.setFontSize(8);
    const badgeW = pdf.getTextWidth(badge) + 10;
    const badgeX = rightX - badgeW;
    const badgeY = y + 12;
    setFill(accent);
    pdf.roundedRect(badgeX, badgeY, badgeW, 6, 3, 3, 'F');
    setText([255, 255, 255]);
    pdf.text(badge, badgeX + badgeW / 2, badgeY + 4.1, { align: 'center' });

    y += 28;
    setFill(accent);
    pdf.rect(marginX, y, contentW, 1.4, 'F');
    y += 8;
  }

  function drawMetaStrip(rows) {
    const stripH = 16;
    ensureSpace(stripH + 4);
    setFill(greenTint);
    setDraw(border);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(marginX, y, contentW, stripH, 2, 2, 'FD');

    const colW = contentW / rows.length;
    rows.forEach((row, index) => {
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
  }

  function drawSectionTitle(title) {
    ensureSpace(8);
    setText(accent);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(8.5);
    pdf.text(String(title).toUpperCase(), marginX, y);
    y += 6;
  }

  function drawInfoPanel(title, items) {
    const cols = 2;
    const colW = contentW / cols - 4;
    const rows = Math.ceil(items.length / cols);
    const panelH = 10 + rows * 11 + 4;
    ensureSpace(panelH + 4);

    const panelY = y;
    setDraw(border);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(marginX, panelY, contentW, panelH, 2, 2, 'D');
    setFill(accent);
    pdf.rect(marginX, panelY, 1.4, panelH, 'F');

    setText(accent);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(8.5);
    pdf.text(String(title).toUpperCase(), marginX + 6, panelY + 7);

    items.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const ix = marginX + 6 + col * (contentW / cols);
      const iy = panelY + 12 + row * 11;
      setText(muted);
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(7);
      pdf.text(String(item.label).toUpperCase(), ix, iy);
      setText(ink);
      pdf.setFont(undefined, 'bold');
      pdf.setFontSize(9.5);
      const valueLines = pdf.splitTextToSize(String(item.value ?? 'N/A'), colW);
      pdf.text(valueLines.slice(0, 2), ix, iy + 4);
    });

    y = panelY + panelH + 8;
  }

  function drawSummaryTable(rows) {
    const domainW = 46;
    const scoreW = 22;
    const interpW = contentW - domainW - scoreW;
    const headH = 8;
    const rowPad = 3;

    ensureSpace(headH + 12);
    setFill(accent);
    pdf.rect(marginX, y, contentW, headH, 'F');
    setText([255, 255, 255]);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(8);
    pdf.text('DOMAIN', marginX + 2, y + 5.3);
    pdf.text('SCORE', marginX + domainW + 2, y + 5.3);
    pdf.text('INTERPRETATION', marginX + domainW + scoreW + 2, y + 5.3);
    y += headH;

    rows.forEach((row, index) => {
      const domainLines = pdf.splitTextToSize(String(row.domain), domainW - 4);
      const scoreLines = pdf.splitTextToSize(String(row.score), scoreW - 4);
      const interpLines = pdf.splitTextToSize(String(row.interpretation), interpW - 4);
      const rowH = Math.max(domainLines.length, scoreLines.length, interpLines.length) * 4.2 + rowPad * 2;

      ensureSpace(rowH + 2);
      if (index % 2 === 1) {
        setFill(greenTint);
        pdf.rect(marginX, y, contentW, rowH, 'F');
      }
      setDraw(border);
      pdf.setLineWidth(0.2);
      pdf.line(marginX, y + rowH, rightX, y + rowH);

      setText(ink);
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(8.5);
      pdf.text(domainLines, marginX + 2, y + rowPad + 3);
      pdf.text(scoreLines, marginX + domainW + 2, y + rowPad + 3);
      pdf.text(interpLines, marginX + domainW + scoreW + 2, y + rowPad + 3);
      y += rowH;
    });
    y += 6;
  }

  function drawDomainSection(section) {
    const bodyLines = section.lines.flatMap((line) =>
      pdf.splitTextToSize(`• ${line}`, contentW - 14),
    );
    const panelH = 10 + bodyLines.length * 4.2 + 4;
    ensureSpace(panelH + 4);

    const panelY = y;
    setDraw(border);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(marginX, panelY, contentW, panelH, 2, 2, 'D');
    setFill(accent);
    pdf.rect(marginX, panelY, 1.4, panelH, 'F');

    setText(greenDark);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(9);
    pdf.text(String(section.title), marginX + 6, panelY + 7);

    setText(ink);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(8.5);
    pdf.text(bodyLines, marginX + 6, panelY + 12);

    y = panelY + panelH + 6;
  }

  function drawScorePanel(score) {
    const panelH = 24;
    ensureSpace(panelH + 6);
    setFill(greenTint);
    setDraw(border);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(marginX, y, contentW, panelH, 3, 3, 'FD');
    setFill(accent);
    pdf.rect(marginX, y + 4, 1.4, panelH - 8, 'F');

    setText(muted);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(10);
    pdf.text('Total Score', pageWidth / 2, y + 9, { align: 'center' });
    setText(greenDark);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(24);
    pdf.text(String(score), pageWidth / 2, y + 18, { align: 'center' });
    y += panelH + 8;
  }

  function drawTextPanel(title, paragraphs) {
    const filtered = paragraphs.filter(Boolean);
    if (!filtered.length) return;

    const bodyLines = filtered.flatMap((p) => pdf.splitTextToSize(String(p), contentW - 14));
    const panelH = 10 + bodyLines.length * 4.2 + 4;
    ensureSpace(panelH + 4);

    const panelY = y;
    setDraw(border);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(marginX, panelY, contentW, panelH, 2, 2, 'D');
    setFill(accent);
    pdf.rect(marginX, panelY, 1.4, panelH, 'F');

    setText(accent);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(8.5);
    pdf.text(String(title).toUpperCase(), marginX + 6, panelY + 7);

    setText(ink);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(9);
    pdf.text(bodyLines, marginX + 6, panelY + 12);

    y = panelY + panelH + 6;
  }

  function drawNotes() {
    const notes = [
      'This screening is not a diagnosis',
      'Further clinical evaluation may be required',
      'Early intervention improves outcomes',
    ];
    const bodyLines = notes.flatMap((n) => pdf.splitTextToSize(`• ${n}`, contentW - 14));
    const panelH = 10 + bodyLines.length * 4.2 + 4;
    ensureSpace(panelH + 4);

    const panelY = y;
    setFill(warnBg);
    setDraw(warnBorder);
    pdf.setLineWidth(0.4);
    pdf.roundedRect(marginX, panelY, contentW, panelH, 2, 2, 'FD');
    setFill(warnBorder);
    pdf.rect(marginX, panelY, 1.4, panelH, 'F');

    setText([146, 64, 14]);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(8.5);
    pdf.text('IMPORTANT NOTES', marginX + 6, panelY + 7);
    setText([146, 64, 14]);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(8.5);
    pdf.text(bodyLines, marginX + 6, panelY + 12);
    y = panelY + panelH + 8;
  }

  function drawAssessorBlock() {
    const fields = ['Name', 'Designation', 'Institution', 'Signature', 'Date'];
    const panelH = 10 + fields.length * 8 + 4;
    ensureSpace(panelH + 4);

    const panelY = y;
    setDraw(border);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(marginX, panelY, contentW, panelH, 2, 2, 'D');

    setText(accent);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(8.5);
    pdf.text("ASSESSOR'S INFORMATION", marginX + 6, panelY + 7);

    fields.forEach((field, index) => {
      const iy = panelY + 13 + index * 8;
      setText(ink);
      pdf.setFont(undefined, 'bold');
      pdf.setFontSize(8.5);
      pdf.text(`${field}:`, marginX + 6, iy);
      setDraw(ink);
      pdf.setLineWidth(0.3);
      pdf.line(marginX + 30, iy + 1, rightX - 6, iy + 1);
    });

    y = panelY + panelH + 8;
  }

  function drawFooter() {
    ensureSpace(16);
    setDraw(accent);
    pdf.setLineWidth(0.6);
    pdf.line(marginX, y, rightX, y);
    y += 6;
    setText(muted);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(8);
    pdf.text(
      'This report is confidential and intended for the parent/guardian and authorized healthcare providers only.',
      pageWidth / 2,
      y,
      { align: 'center' },
    );
    y += 5;
    setText(greenDark);
    pdf.setFont(undefined, 'bold');
    pdf.text(
      `Generated by ${COMPANY_INFO.name} via Autibile on ${new Date().toLocaleDateString('en-MY')}.`,
      pageWidth / 2,
      y,
      { align: 'center' },
    );
  }

  return {
    pdf,
    drawBrandHeader,
    drawMetaStrip,
    drawSectionTitle,
    drawInfoPanel,
    drawSummaryTable,
    drawDomainSection,
    drawScorePanel,
    drawTextPanel,
    drawNotes,
    drawAssessorBlock,
    drawFooter,
  };
}

export async function renderIntegratedScreeningPdf(jsPDF, data) {
  const r = createPdfRenderer(jsPDF);
  await r.drawBrandHeader('SCREENING REPORT', 'Multi-Domain');
  r.drawMetaStrip([
    { label: 'Report Generated', value: new Date().toLocaleString('en-MY') },
    { label: 'Report Type', value: 'Integrated Developmental Screening' },
    { label: 'Screening Date', value: data.screeningDate },
  ]);
  r.drawInfoPanel('Child Information', [
    { label: "Child's Name", value: data.childName },
    { label: 'Age at Screening', value: data.childAge },
    { label: 'Date of Birth', value: data.childDOB },
    { label: 'Gender', value: data.childGender },
  ]);
  r.drawInfoPanel('Parent / Caregiver Information', [
    { label: 'Name', value: data.parentName },
    { label: 'Relationship to Child', value: data.parentRelationship },
  ]);
  r.drawSectionTitle('Summary Table');
  r.drawSummaryTable(data.summaryRows || []);
  r.drawSectionTitle('Detailed Scoring Breakdowns');
  (data.domainSections || []).forEach((section) => r.drawDomainSection(section));
  r.drawNotes();
  r.drawAssessorBlock();
  r.drawFooter();
  return r.pdf;
}

export async function renderIndividualScreeningPdf(jsPDF, data) {
  const r = createPdfRenderer(jsPDF);
  await r.drawBrandHeader('SCREENING RESULT', 'Individual Report');
  r.drawMetaStrip([
    { label: 'Report Generated', value: new Date().toLocaleString('en-MY') },
    { label: 'Assessment', value: data.questionnaireTitle },
    { label: 'Patient ID', value: String(data.patientId ?? 'N/A') },
  ]);
  r.drawInfoPanel('Child Information', [
    { label: "Child's Name", value: data.childName },
    { label: 'Patient ID', value: String(data.patientId ?? 'N/A') },
  ]);
  r.drawScorePanel(data.score);
  r.drawTextPanel('Prediction', [
    data.interpretation && data.interpretation !== 'No prediction available'
      ? `Based on Score (${data.score}): ${data.interpretation}`
      : null,
    data.interpretation_bm || null,
    data.aiAnalysis?.explanation ? `AI Analysis: ${data.aiAnalysis.explanation}` : null,
  ]);
  r.drawTextPanel('Recommendation', [
    data.recommendation && data.recommendation !== 'No recommendation available'
      ? data.recommendation
      : null,
    data.recommendation_bm || null,
    data.aiAnalysis?.result ? `AI Recommendation: ${data.aiAnalysis.result}` : null,
  ]);
  if (data.showMchatFollowUp) {
    r.drawTextPanel('Next Steps', [
      'Based on your score, the patient needs to take the next level questionnaire (M-CHAT-R/F). Please contact our administrator for the next process.',
    ]);
  }
  r.drawNotes();
  r.drawFooter();
  return r.pdf;
}

export async function downloadIntegratedScreeningPdf(data, filename) {
  const { default: jsPDF } = await import('jspdf');
  const pdf = await renderIntegratedScreeningPdf(jsPDF, data);
  pdf.save(filename);
}

export async function downloadIndividualScreeningPdf(data, filename) {
  const { default: jsPDF } = await import('jspdf');
  const pdf = await renderIndividualScreeningPdf(jsPDF, data);
  pdf.save(filename);
}

/** @deprecated Use downloadIntegratedScreeningPdf or downloadIndividualScreeningPdf */
export async function downloadScreeningReportPdf(html, filename) {
  const { default: jsPDF } = await import('jspdf');
  const { default: html2canvas } = await import('html2canvas');

  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:fixed;left:-10000px;top:0;width:780px;background:#fff;padding:0;';

  const parsed = new DOMParser().parseFromString(html, 'text/html');
  parsed.querySelectorAll('style').forEach((styleEl) => {
    wrapper.appendChild(styleEl.cloneNode(true));
  });

  const docEl = parsed.querySelector('.doc');
  if (docEl) {
    wrapper.appendChild(docEl.cloneNode(true));
  } else if (parsed.body) {
    wrapper.appendChild(parsed.body.cloneNode(true));
  }

  document.body.appendChild(wrapper);

  try {
    await new Promise((resolve) => setTimeout(resolve, 400));

    const canvas = await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    let remainingHeight = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    remainingHeight -= pageHeight;

    while (remainingHeight > 0) {
      position = remainingHeight - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      remainingHeight -= pageHeight;
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(wrapper);
  }
}

export function printScreeningReport(html) {
  openPrintWindow(html);
}
