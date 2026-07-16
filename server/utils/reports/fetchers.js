import prisma from "~/server/utils/prisma";
import {
  getAppointmentTimes,
  buildSessionNumberMap,
} from "~/server/utils/appointmentTime";
import { getAppointmentStatusLabel } from "~/utils/reportDefinitions";

/**
 * Per-entity data fetchers for the admin report generator.
 * Each returns an array of flat row objects whose keys match the column keys
 * declared in utils/reportDefinitions.js.
 */

function toDate(value) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function asArray(value) {
  if (value === undefined || value === null || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

function mapTreatmentType(treatmentType) {
  if (!treatmentType) return "";
  const typeMap = {
    1: "Centre",
    2: "Online",
    3: "In House",
    "1": "Centre",
    "2": "Online",
    "3": "In House",
    Centre: "Centre",
    Online: "Online",
    "In House": "In House",
  };
  return typeMap[treatmentType] || String(treatmentType);
}

async function fetchAppointmentRows(filters = {}) {
  const where = { deleted_at: null };

  if (filters.patient_id) where.patient_id = parseInt(filters.patient_id);
  if (filters.practitioner_id)
    where.practitioner_id = parseInt(filters.practitioner_id);
  if (filters.service_id) where.service_id = parseInt(filters.service_id);

  const statuses = asArray(filters.status)
    .map((s) => parseInt(s))
    .filter((s) => !Number.isNaN(s));
  if (statuses.length === 1) where.status = statuses[0];
  else if (statuses.length > 1) where.status = { in: statuses };

  const range = filters.dateRange || {};
  if (range.start) where.date = { gte: new Date(range.start) };
  if (range.end) where.date = { ...(where.date || {}), lte: new Date(range.end) };

  if (filters.scope === "admin") where.practitioner_id = null;
  else if (filters.scope === "assigned") where.practitioner_id = { not: null };

  const appointments = await prisma.appointments.findMany({
    where,
    include: {
      user_patients: true,
      user_practitioners: { include: { user: true } },
      service: true,
      lookup: true,
      user: true,
    },
    orderBy: { date: "asc" },
  });

  // Session numbers computed from each patient's full non-deleted,
  // non-cancelled history so the report matches the app exactly.
  const sessionNumberById = await buildSessionNumberMap(
    prisma,
    appointments.map((appt) => appt.patient_id),
  );

  // Resolve each patient's parent in one query (join user_parent_patient ->
  // user_parents -> user).
  const patientIds = [
    ...new Set(appointments.map((a) => a.patient_id).filter((id) => id != null)),
  ];
  const relations = patientIds.length
    ? await prisma.user_parent_patient.findMany({
        where: { patient_id: { in: patientIds } },
        include: { user_parents: { include: { user: true } } },
      })
    : [];
  const parentByPatient = {};
  for (const r of relations) {
    if (!parentByPatient[r.patient_id]) {
      parentByPatient[r.patient_id] = {
        name: r.user_parents?.user?.userFullName || "",
        phone: r.user_parents?.parent_phone || "",
      };
    }
  }

  return appointments.map((appt) => {
    const { start_time, end_time } = getAppointmentTimes(appt);
    const isAdmin = appt.practitioner_id === null;
    return {
      appointment_id: appt.appointment_id,
      date: toDate(appt.date),
      start_time,
      end_time,
      patient_name: appt.user_patients?.fullname || "",
      patient_ic: appt.user_patients?.patient_ic || "",
      parent_name: parentByPatient[appt.patient_id]?.name || "",
      parent_phone: parentByPatient[appt.patient_id]?.phone || "",
      practitioner_name: isAdmin
        ? "Admin"
        : appt.user_practitioners?.user?.userFullName || "",
      service_name: appt.service?.name || "",
      status_label: getAppointmentStatusLabel(appt.status),
      session_number: sessionNumberById[appt.appointment_id] || null,
      parent_rate: toNumber(appt.parent_rate),
      parent_comment: appt.parent_comment || "",
      therapist_doctor_comment: appt.therapist_doctor_comment || "",
      booked_by_name: appt.user?.userFullName || "",
      created_at: toDate(appt.created_at),
    };
  });
}

async function fetchPractitionerRows(filters = {}) {
  const where = { deleted_at: null };
  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;

  const [practitioners, departmentLookups] = await Promise.all([
    prisma.user_practitioners.findMany({
      where,
      include: { user: true },
      orderBy: { practitioner_id: "asc" },
    }),
    prisma.lookup.findMany({ where: { type: "department" } }),
  ]);

  const departmentById = {};
  for (const l of departmentLookups)
    departmentById[l.lookupID] = l.title || l.value;

  return practitioners.map((p) => ({
    practitioner_id: p.practitioner_id,
    fullName: p.user?.userFullName || "",
    email: p.user?.userEmail || "",
    phone: p.user?.userPhone || "",
    ic: p.user?.userIC || "",
    type: p.type || "",
    registrationNo: p.registration_no || "",
    specialty: p.specialty || "",
    department: p.department != null ? departmentById[p.department] || "" : "",
    qualification: p.qualifications || "",
    experience_years: toNumber(p.experience_years),
    workplace: p.workplace || "",
    status: p.status || "",
  }));
}

async function fetchPatientRows(filters = {}) {
  const where = { deleted_at: null };
  if (filters.status) where.status = filters.status;
  if (filters.gender) where.gender = filters.gender;

  const range = filters.diagnosedRange || {};
  if (range.start) where.diagnosed_on = { gte: new Date(range.start) };
  if (range.end)
    where.diagnosed_on = { ...(where.diagnosed_on || {}), lte: new Date(range.end) };

  const patients = await prisma.user_patients.findMany({
    where,
    orderBy: { patient_id: "asc" },
  });

  // Resolve parents for the fetched patients in one query.
  const patientIds = patients.map((p) => p.patient_id);
  const relations = patientIds.length
    ? await prisma.user_parent_patient.findMany({
        where: { patient_id: { in: patientIds } },
        include: { user_parents: { include: { user: true } } },
      })
    : [];
  const parentByPatient = {};
  for (const r of relations) {
    if (!parentByPatient[r.patient_id]) {
      parentByPatient[r.patient_id] = {
        name: r.user_parents?.user?.userFullName || "",
        phone: r.user_parents?.parent_phone || "",
      };
    }
  }

  let rows = patients.map((c) => ({
    patient_id: c.patient_id,
    fullname: c.fullname || "",
    nickname: c.nickname || "",
    patient_ic: c.patient_ic || "",
    gender: c.gender || "",
    dob: toDate(c.dob),
    autism_diagnose: c.autism_diagnose || "",
    diagnosed_on: toDate(c.diagnosed_on),
    treatment_type: mapTreatmentType(c.treatment_type),
    available_session: toNumber(c.available_session),
    status: c.status || "",
    mchatr_status: c.mchatr_status || "",
    parent_name: parentByPatient[c.patient_id]?.name || "",
    parent_phone: parentByPatient[c.patient_id]?.phone || "",
  }));

  if (filters.treatment_type) {
    rows = rows.filter((r) => r.treatment_type === filters.treatment_type);
  }

  return rows;
}

async function fetchTherapyServiceRows(filters = {}) {
  const where = { deleted_at: null };
  if (filters.center_id) where.therapy_centerID = parseInt(filters.center_id);

  const [services, centers] = await Promise.all([
    prisma.service.findMany({ where, orderBy: { service_id: "asc" } }),
    prisma.therapyst_center.findMany({ where: { deleted_at: null } }),
  ]);

  const centerById = {};
  for (const c of centers) centerById[c.center_ID] = c.center_name;

  return services.map((s) => ({
    service_id: s.service_id,
    name: s.name || "",
    description: s.description || "",
    center_name:
      s.therapy_centerID != null ? centerById[s.therapy_centerID] || "" : "",
  }));
}

async function fetchPaymentRows(filters = {}) {
  const where = { deleted_at: null };
  if (filters.status) where.status = filters.status;
  if (filters.method) where.method = filters.method;
  if (filters.patient_id) where.patient_id = parseInt(filters.patient_id);
  if (filters.parent_id) where.parent_id = parseInt(filters.parent_id);

  const range = filters.dateRange || {};
  if (range.start) where.created_at = { gte: new Date(range.start) };
  if (range.end)
    where.created_at = { ...(where.created_at || {}), lte: new Date(range.end) };

  const payments = await prisma.payment.findMany({
    where,
    include: {
      invoice: {
        select: {
          invoice_id: true,
          description: true,
          amount: true,
          date: true,
          status: true,
        },
      },
      user_patients: {
        select: { patient_id: true, fullname: true, patient_ic: true },
      },
    },
    orderBy: { created_at: "desc" },
  });

  // Resolve parents (prefer payment.parent_id, fall back to the patient's
  // linked parent) and approver names in bulk.
  const parentIds = [
    ...new Set(payments.map((p) => p.parent_id).filter((id) => id != null)),
  ];
  const patientIds = [
    ...new Set(payments.map((p) => p.patient_id).filter((id) => id != null)),
  ];
  const approverIds = [
    ...new Set(payments.map((p) => p.approved_by).filter((id) => id != null)),
  ];

  const [parents, relations, approvers] = await Promise.all([
    parentIds.length
      ? prisma.user_parents.findMany({
          where: { parent_id: { in: parentIds } },
          include: { user: { select: { userFullName: true } } },
        })
      : [],
    patientIds.length
      ? prisma.user_parent_patient.findMany({
          where: { patient_id: { in: patientIds } },
          include: {
            user_parents: {
              include: { user: { select: { userFullName: true } } },
            },
          },
        })
      : [],
    approverIds.length
      ? prisma.user.findMany({
          where: { userID: { in: approverIds } },
          select: { userID: true, userFullName: true },
        })
      : [],
  ]);

  const parentById = {};
  for (const p of parents) {
    parentById[p.parent_id] = {
      name: p.user?.userFullName || "",
      phone: p.parent_phone || "",
    };
  }
  const parentByPatient = {};
  for (const r of relations) {
    if (!parentByPatient[r.patient_id]) {
      parentByPatient[r.patient_id] = {
        name: r.user_parents?.user?.userFullName || "",
        phone: r.user_parents?.parent_phone || "",
      };
    }
  }
  const approverById = {};
  for (const a of approvers) approverById[a.userID] = a.userFullName || "";

  return payments.map((p) => {
    const parent =
      (p.parent_id != null ? parentById[p.parent_id] : null) ||
      parentByPatient[p.patient_id] ||
      {};
    return {
      payment_id: p.payment_id,
      created_at: toDate(p.created_at),
      patient_name: p.user_patients?.fullname || "",
      patient_ic: p.user_patients?.patient_ic || "",
      parent_name: parent.name || "",
      parent_phone: parent.phone || "",
      invoice_id: p.invoice_id,
      invoice_description: p.invoice?.description || "",
      invoice_amount: toNumber(p.invoice?.amount),
      amount: toNumber(p.amount),
      method: p.method || "",
      bank_name: p.bank_name || "",
      reference_code: p.reference_code || "",
      status: p.status || "",
      submitted_by: p.submitted_by || "",
      approved_by_name: p.approved_by != null ? approverById[p.approved_by] || "" : "",
      approved_at: toDate(p.approved_at),
    };
  });
}

function computeAgingBucket(date, balance) {
  if (!(balance > 0)) return "Settled";
  if (!date) return "Unknown";
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days <= 30) return "Current (0-30)";
  if (days <= 60) return "31-60 days";
  if (days <= 90) return "61-90 days";
  return "90+ days";
}

async function fetchInvoiceRows(filters = {}) {
  const where = { deleted_at: null };
  if (filters.status) where.status = filters.status;
  if (filters.patient_id) where.patient_id = parseInt(filters.patient_id);

  const range = filters.dateRange || {};
  if (range.start) where.date = { gte: new Date(range.start) };
  if (range.end) where.date = { ...(where.date || {}), lte: new Date(range.end) };

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      user_patients: {
        select: { patient_id: true, fullname: true, patient_ic: true },
      },
      payment: { select: { amount: true, status: true, deleted_at: true } },
    },
    orderBy: { date: "desc" },
  });

  const patientIds = [
    ...new Set(invoices.map((i) => i.patient_id).filter((id) => id != null)),
  ];
  const relations = patientIds.length
    ? await prisma.user_parent_patient.findMany({
        where: { patient_id: { in: patientIds } },
        include: {
          user_parents: { include: { user: { select: { userFullName: true } } } },
        },
      })
    : [];
  const parentByPatient = {};
  for (const r of relations) {
    if (!parentByPatient[r.patient_id]) {
      parentByPatient[r.patient_id] = r.user_parents?.user?.userFullName || "";
    }
  }

  return invoices.map((inv) => {
    const amount = toNumber(inv.amount) || 0;
    const amountPaid = (inv.payment || [])
      .filter((p) => p.deleted_at == null && p.status === "Approved")
      .reduce((sum, p) => sum + (toNumber(p.amount) || 0), 0);
    const balance = amount - amountPaid;
    return {
      invoice_id: inv.invoice_id,
      date: toDate(inv.date),
      patient_name: inv.user_patients?.fullname || "",
      patient_ic: inv.user_patients?.patient_ic || "",
      parent_name: parentByPatient[inv.patient_id] || "",
      invoice_type: inv.invoice_type || "",
      description: inv.description || "",
      amount,
      amount_paid: amountPaid,
      balance,
      status: inv.status || "",
      aging_bucket: computeAgingBucket(inv.date, balance),
      created_at: toDate(inv.created_at),
    };
  });
}

async function fetchScreeningRows(filters = {}) {
  const where = {};
  if (filters.questionnaire_id)
    where.questionnaire_id = parseInt(filters.questionnaire_id);
  if (filters.patient_id) where.patient_id = parseInt(filters.patient_id);

  const range = filters.dateRange || {};
  if (range.start) where.created_at = { gte: new Date(range.start) };
  if (range.end)
    where.created_at = { ...(where.created_at || {}), lte: new Date(range.end) };

  const responses = await prisma.questionnaires_responds.findMany({
    where,
    include: {
      questionnaires: { select: { title: true } },
      user_patients: { select: { fullname: true, patient_ic: true } },
    },
    orderBy: { created_at: "desc" },
  });

  // Build interpretation bands per questionnaire from questionnaire_scoring.
  const questionnaireIds = [
    ...new Set(
      responses.map((r) => r.questionnaire_id).filter((id) => id != null),
    ),
  ];
  const scoringRows = questionnaireIds.length
    ? await prisma.questionnaire_scoring.findMany({
        where: {
          scoring_questionnaires: { in: questionnaireIds },
          deleted_at: null,
        },
      })
    : [];
  const scoringByQuestionnaire = {};
  for (const s of scoringRows) {
    if (!scoringByQuestionnaire[s.scoring_questionnaires])
      scoringByQuestionnaire[s.scoring_questionnaires] = [];
    scoringByQuestionnaire[s.scoring_questionnaires].push(s);
  }

  const interpret = (questionnaireId, score) => {
    if (score == null) return "";
    const bands = scoringByQuestionnaire[questionnaireId] || [];
    const match = bands.find(
      (b) => score >= b.scoring_min && score <= b.scoring_max,
    );
    return match ? match.scoring_interpretation : "";
  };

  return responses.map((r) => ({
    qr_id: r.qr_id,
    created_at: toDate(r.created_at),
    patient_name: r.user_patients?.fullname || "",
    patient_ic: r.user_patients?.patient_ic || "",
    questionnaire_title: r.questionnaires?.title || "",
    total_score: toNumber(r.total_score),
    score_s2: toNumber(r.score_s2),
    interpretation: interpret(r.questionnaire_id, toNumber(r.total_score)),
  }));
}

async function fetchSessionUtilizationRows(filters = {}) {
  const where = { deleted_at: null };
  if (filters.status) where.status = filters.status;

  const patients = await prisma.user_patients.findMany({
    where,
    orderBy: { patient_id: "asc" },
  });

  const patientIds = patients.map((p) => p.patient_id);

  const [appointments, relations] = await Promise.all([
    patientIds.length
      ? prisma.appointments.findMany({
          where: { patient_id: { in: patientIds }, deleted_at: null },
          select: { patient_id: true, status: true, date: true },
        })
      : [],
    patientIds.length
      ? prisma.user_parent_patient.findMany({
          where: { patient_id: { in: patientIds } },
          include: {
            user_parents: {
              include: { user: { select: { userFullName: true } } },
            },
          },
        })
      : [],
  ]);

  const statsByPatient = {};
  for (const a of appointments) {
    if (!statsByPatient[a.patient_id]) {
      statsByPatient[a.patient_id] = { booked: 0, completed: 0, last: null };
    }
    const st = statsByPatient[a.patient_id];
    if (a.status !== 37) st.booked += 1; // exclude Cancelled
    if (a.status === 41) st.completed += 1; // Completed
    if (a.date && (!st.last || a.date.getTime() > st.last.getTime())) {
      st.last = a.date;
    }
  }

  const parentByPatient = {};
  for (const r of relations) {
    if (!parentByPatient[r.patient_id]) {
      parentByPatient[r.patient_id] = r.user_parents?.user?.userFullName || "";
    }
  }

  let rows = patients.map((c) => {
    const st = statsByPatient[c.patient_id] || { booked: 0, completed: 0, last: null };
    return {
      patient_id: c.patient_id,
      patient_name: c.fullname || "",
      patient_ic: c.patient_ic || "",
      parent_name: parentByPatient[c.patient_id] || "",
      treatment_type: mapTreatmentType(c.treatment_type),
      available_session: toNumber(c.available_session) || 0,
      sessions_booked: st.booked,
      sessions_completed: st.completed,
      last_session_date: st.last ? toDate(st.last) : null,
      status: c.status || "",
    };
  });

  if (filters.treatment_type) {
    rows = rows.filter((r) => r.treatment_type === filters.treatment_type);
  }

  return rows;
}

const FETCHERS = {
  appointments: fetchAppointmentRows,
  payment: fetchPaymentRows,
  invoices: fetchInvoiceRows,
  screening: fetchScreeningRows,
  sessionUtilization: fetchSessionUtilizationRows,
  practitioners: fetchPractitionerRows,
  patients: fetchPatientRows,
  therapyServices: fetchTherapyServiceRows,
};

export async function fetchReportRows(entity, filters = {}) {
  const fetcher = FETCHERS[entity];
  if (!fetcher) {
    throw new Error(`Unknown report entity: ${entity}`);
  }
  return fetcher(filters);
}
