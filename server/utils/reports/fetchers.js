import prisma from "~/server/utils/prisma";
import { getAppointmentTimes } from "~/server/utils/appointmentTime";
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

  // Compute per-patient session numbers (chronological), mirroring list.get.js.
  const byPatient = {};
  for (const appt of appointments) {
    const pid = appt.patient_id;
    if (!byPatient[pid]) byPatient[pid] = [];
    byPatient[pid].push(appt);
  }
  const sessionNumberById = {};
  for (const pid in byPatient) {
    byPatient[pid]
      .slice()
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .forEach((appt, index) => {
        sessionNumberById[appt.appointment_id] = index + 1;
      });
  }

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

const FETCHERS = {
  appointments: fetchAppointmentRows,
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
