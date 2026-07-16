/**
 * Shared metadata for the admin Excel report generator.
 *
 * A single source of truth consumed by:
 *  - the client (pages/reports/index.vue) to render the builder form, and
 *  - the server (server/utils/reports/*) to validate config, query data,
 *    and build the workbook.
 *
 * Column `type` drives Excel formatting: string | number | currency | date |
 * time | datetime.
 */

export const APPOINTMENT_STATUS = [
  { value: 36, label: "Booked" },
  { value: 37, label: "Cancelled" },
  { value: 38, label: "Start" },
  { value: 39, label: "Confirm Start" },
  { value: 40, label: "Finish" },
  { value: 41, label: "Completed" },
];

export function getAppointmentStatusLabel(id) {
  const found = APPOINTMENT_STATUS.find((s) => Number(s.value) === Number(id));
  return found ? found.label : id != null ? String(id) : "";
}

export const APPOINTMENT_SCOPE = [
  { value: "all", label: "All appointments" },
  { value: "assigned", label: "Assigned to practitioner" },
  { value: "admin", label: "Admin appointments" },
];

const appointments = {
  key: "appointments",
  label: "Appointments",
  sheetName: "Appointments",
  columns: [
    { key: "appointment_id", label: "ID", type: "number", width: 8 },
    { key: "date", label: "Date", type: "date", width: 14 },
    { key: "start_time", label: "Start", type: "time", width: 10 },
    { key: "end_time", label: "End", type: "time", width: 10 },
    { key: "patient_name", label: "Patient", type: "string", width: 24 },
    { key: "patient_ic", label: "Patient IC", type: "string", width: 18 },
    { key: "parent_name", label: "Parent", type: "string", width: 24 },
    { key: "parent_phone", label: "Parent Phone", type: "string", width: 16 },
    { key: "practitioner_name", label: "Practitioner", type: "string", width: 24 },
    { key: "service_name", label: "Service", type: "string", width: 20 },
    { key: "status_label", label: "Status", type: "string", width: 14 },
    { key: "session_number", label: "Session #", type: "number", width: 10 },
    { key: "parent_rate", label: "Rating", type: "number", width: 10 },
    { key: "parent_comment", label: "Parent Comment", type: "string", width: 30 },
    {
      key: "therapist_doctor_comment",
      label: "Practitioner Comment",
      type: "string",
      width: 30,
    },
    { key: "booked_by_name", label: "Booked By", type: "string", width: 20 },
    { key: "created_at", label: "Created At", type: "datetime", width: 20 },
  ],
  defaultColumns: [
    "date",
    "start_time",
    "end_time",
    "patient_name",
    "parent_name",
    "practitioner_name",
    "service_name",
    "status_label",
    "parent_rate",
  ],
  filters: [
    { key: "dateRange", label: "Appointment Date", type: "dateRange", field: "date" },
    { key: "patient_id", label: "Patient", type: "select", optionsSource: "patients" },
    {
      key: "practitioner_id",
      label: "Practitioner",
      type: "select",
      optionsSource: "practitioners",
    },
    { key: "service_id", label: "Service", type: "select", optionsSource: "services" },
    {
      key: "status",
      label: "Status",
      type: "multiselect",
      options: APPOINTMENT_STATUS,
    },
    { key: "scope", label: "Scope", type: "select", options: APPOINTMENT_SCOPE },
  ],
  groupableKeys: [
    "patient_name",
    "parent_name",
    "practitioner_name",
    "service_name",
    "status_label",
    "date",
  ],
  sortableKeys: [
    "date",
    "start_time",
    "patient_name",
    "parent_name",
    "practitioner_name",
    "service_name",
    "status_label",
    "parent_rate",
  ],
  defaultSort: { key: "date", dir: "asc" },
  summable: [{ key: "parent_rate", agg: "avg" }],
};

const practitioners = {
  key: "practitioners",
  label: "Practitioners",
  sheetName: "Practitioners",
  columns: [
    { key: "practitioner_id", label: "ID", type: "number", width: 8 },
    { key: "fullName", label: "Full Name", type: "string", width: 26 },
    { key: "email", label: "Email", type: "string", width: 28 },
    { key: "phone", label: "Phone", type: "string", width: 16 },
    { key: "ic", label: "IC", type: "string", width: 18 },
    { key: "type", label: "Type", type: "string", width: 16 },
    { key: "registrationNo", label: "Reg. No", type: "string", width: 16 },
    { key: "specialty", label: "Specialty", type: "string", width: 22 },
    { key: "department", label: "Department", type: "string", width: 20 },
    { key: "qualification", label: "Qualification", type: "string", width: 24 },
    { key: "experience_years", label: "Experience (yrs)", type: "number", width: 14 },
    { key: "workplace", label: "Workplace", type: "string", width: 26 },
    { key: "status", label: "Status", type: "string", width: 14 },
  ],
  defaultColumns: [
    "fullName",
    "email",
    "phone",
    "type",
    "specialty",
    "department",
    "status",
  ],
  filters: [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "ACTIVE", label: "Active" },
        { value: "INACTIVE", label: "Inactive" },
      ],
    },
    {
      key: "type",
      label: "Type",
      type: "select",
      options: [
        { value: "Doctor", label: "Doctor" },
        { value: "Therapist", label: "Therapist" },
      ],
    },
  ],
  groupableKeys: ["type", "department", "status", "specialty"],
  sortableKeys: [
    "fullName",
    "type",
    "specialty",
    "department",
    "experience_years",
    "status",
  ],
  defaultSort: { key: "fullName", dir: "asc" },
  summable: [{ key: "experience_years", agg: "avg" }],
};

const patients = {
  key: "patients",
  label: "Patients",
  sheetName: "Patients",
  columns: [
    { key: "patient_id", label: "ID", type: "number", width: 8 },
    { key: "fullname", label: "Full Name", type: "string", width: 26 },
    { key: "nickname", label: "Nickname", type: "string", width: 16 },
    { key: "patient_ic", label: "IC", type: "string", width: 18 },
    { key: "gender", label: "Gender", type: "string", width: 12 },
    { key: "dob", label: "Date of Birth", type: "date", width: 14 },
    { key: "autism_diagnose", label: "Autism Diagnosis", type: "string", width: 20 },
    { key: "diagnosed_on", label: "Diagnosed On", type: "date", width: 14 },
    { key: "treatment_type", label: "Treatment Type", type: "string", width: 16 },
    { key: "available_session", label: "Available Sessions", type: "number", width: 16 },
    { key: "status", label: "Status", type: "string", width: 12 },
    { key: "mchatr_status", label: "M-CHAT-R Status", type: "string", width: 18 },
    { key: "parent_name", label: "Parent", type: "string", width: 24 },
    { key: "parent_phone", label: "Parent Phone", type: "string", width: 16 },
  ],
  defaultColumns: [
    "fullname",
    "nickname",
    "patient_ic",
    "gender",
    "dob",
    "autism_diagnose",
    "treatment_type",
    "available_session",
    "status",
    "parent_name",
  ],
  filters: [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "ACTIVE", label: "Active" },
        { value: "INACTIVE", label: "Inactive" },
      ],
    },
    {
      key: "gender",
      label: "Gender",
      type: "select",
      options: [
        { value: "Male", label: "Male" },
        { value: "Female", label: "Female" },
      ],
    },
    {
      key: "treatment_type",
      label: "Treatment Type",
      type: "select",
      options: [
        { value: "Centre", label: "Centre" },
        { value: "Online", label: "Online" },
        { value: "In House", label: "In House" },
      ],
    },
    {
      key: "diagnosedRange",
      label: "Diagnosed Date",
      type: "dateRange",
      field: "diagnosed_on",
    },
  ],
  groupableKeys: [
    "parent_name",
    "gender",
    "treatment_type",
    "status",
    "autism_diagnose",
  ],
  sortableKeys: [
    "fullname",
    "parent_name",
    "dob",
    "diagnosed_on",
    "available_session",
    "status",
    "gender",
  ],
  defaultSort: { key: "fullname", dir: "asc" },
  summable: [{ key: "available_session", agg: "sum" }],
};

const therapyServices = {
  key: "therapyServices",
  label: "Therapy Services",
  sheetName: "Therapy Services",
  columns: [
    { key: "service_id", label: "ID", type: "number", width: 8 },
    { key: "name", label: "Service Name", type: "string", width: 28 },
    { key: "description", label: "Description", type: "string", width: 40 },
    { key: "center_name", label: "Therapy Centre", type: "string", width: 26 },
  ],
  defaultColumns: ["name", "description", "center_name"],
  filters: [
    { key: "center_id", label: "Therapy Centre", type: "select", optionsSource: "centers" },
  ],
  groupableKeys: ["center_name"],
  sortableKeys: ["name", "center_name"],
  defaultSort: { key: "name", dir: "asc" },
  summable: [],
};

export const PAYMENT_STATUS = [
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];

export const PAYMENT_METHOD = [
  { value: "Online Banking", label: "Online Banking" },
  { value: "Credit Card", label: "Credit Card" },
  { value: "E-Wallet", label: "E-Wallet" },
];

const payment = {
  key: "payment",
  label: "Payments",
  sheetName: "Payments",
  columns: [
    { key: "payment_id", label: "ID", type: "number", width: 8 },
    { key: "created_at", label: "Payment Date", type: "datetime", width: 18 },
    { key: "patient_name", label: "Patient", type: "string", width: 24 },
    { key: "patient_ic", label: "Patient IC", type: "string", width: 18 },
    { key: "parent_name", label: "Parent", type: "string", width: 24 },
    { key: "parent_phone", label: "Parent Phone", type: "string", width: 16 },
    { key: "invoice_id", label: "Invoice #", type: "number", width: 10 },
    {
      key: "invoice_description",
      label: "Invoice Description",
      type: "string",
      width: 30,
    },
    { key: "invoice_amount", label: "Invoice Amount", type: "currency", width: 16 },
    { key: "amount", label: "Amount Paid", type: "currency", width: 16 },
    { key: "method", label: "Method", type: "string", width: 16 },
    { key: "bank_name", label: "Bank", type: "string", width: 18 },
    { key: "reference_code", label: "Reference", type: "string", width: 20 },
    { key: "status", label: "Status", type: "string", width: 14 },
    { key: "submitted_by", label: "Submitted By", type: "string", width: 16 },
    { key: "approved_by_name", label: "Approved By", type: "string", width: 20 },
    { key: "approved_at", label: "Approved At", type: "datetime", width: 18 },
  ],
  defaultColumns: [
    "created_at",
    "patient_name",
    "parent_name",
    "invoice_description",
    "amount",
    "method",
    "status",
    "reference_code",
  ],
  filters: [
    { key: "dateRange", label: "Payment Date", type: "dateRange", field: "created_at" },
    { key: "status", label: "Status", type: "select", options: PAYMENT_STATUS },
    { key: "method", label: "Method", type: "select", options: PAYMENT_METHOD },
    { key: "patient_id", label: "Patient", type: "select", optionsSource: "patients" },
    { key: "parent_id", label: "Parent", type: "select", optionsSource: "parents" },
  ],
  groupableKeys: [
    "status",
    "method",
    "patient_name",
    "parent_name",
    "created_at",
  ],
  sortableKeys: [
    "created_at",
    "amount",
    "invoice_amount",
    "patient_name",
    "parent_name",
    "status",
    "method",
  ],
  defaultSort: { key: "created_at", dir: "desc" },
  summable: [
    { key: "amount", agg: "sum" },
    { key: "invoice_amount", agg: "sum" },
  ],
};

const INVOICE_STATUS = [
  { value: "Paid", label: "Paid" },
  { value: "Unpaid", label: "Unpaid" },
];

const invoices = {
  key: "invoices",
  label: "Invoices (AR Aging)",
  sheetName: "Invoices",
  columns: [
    { key: "invoice_id", label: "Invoice #", type: "number", width: 10 },
    { key: "date", label: "Invoice Date", type: "date", width: 14 },
    { key: "patient_name", label: "Patient", type: "string", width: 24 },
    { key: "patient_ic", label: "Patient IC", type: "string", width: 18 },
    { key: "parent_name", label: "Parent", type: "string", width: 24 },
    { key: "invoice_type", label: "Type", type: "string", width: 18 },
    { key: "description", label: "Description", type: "string", width: 30 },
    { key: "amount", label: "Amount Billed", type: "currency", width: 16 },
    { key: "amount_paid", label: "Amount Paid", type: "currency", width: 16 },
    { key: "balance", label: "Balance", type: "currency", width: 16 },
    { key: "status", label: "Status", type: "string", width: 12 },
    { key: "aging_bucket", label: "Aging", type: "string", width: 16 },
    { key: "created_at", label: "Created At", type: "datetime", width: 18 },
  ],
  defaultColumns: [
    "date",
    "patient_name",
    "invoice_type",
    "amount",
    "amount_paid",
    "balance",
    "status",
    "aging_bucket",
  ],
  filters: [
    { key: "dateRange", label: "Invoice Date", type: "dateRange", field: "date" },
    { key: "status", label: "Status", type: "select", options: INVOICE_STATUS },
    { key: "patient_id", label: "Patient", type: "select", optionsSource: "patients" },
  ],
  groupableKeys: [
    "status",
    "aging_bucket",
    "patient_name",
    "invoice_type",
    "date",
  ],
  sortableKeys: [
    "date",
    "amount",
    "balance",
    "patient_name",
    "status",
    "aging_bucket",
  ],
  defaultSort: { key: "date", dir: "desc" },
  summable: [
    { key: "amount", agg: "sum" },
    { key: "amount_paid", agg: "sum" },
    { key: "balance", agg: "sum" },
  ],
};

const screening = {
  key: "screening",
  label: "Screening Results",
  sheetName: "Screening",
  columns: [
    { key: "qr_id", label: "Response #", type: "number", width: 10 },
    { key: "created_at", label: "Date", type: "datetime", width: 18 },
    { key: "patient_name", label: "Patient", type: "string", width: 24 },
    { key: "patient_ic", label: "Patient IC", type: "string", width: 18 },
    { key: "questionnaire_title", label: "Questionnaire", type: "string", width: 28 },
    { key: "total_score", label: "Total Score", type: "number", width: 12 },
    { key: "score_s2", label: "Section 2 Score", type: "number", width: 14 },
    { key: "interpretation", label: "Interpretation", type: "string", width: 28 },
  ],
  defaultColumns: [
    "created_at",
    "patient_name",
    "questionnaire_title",
    "total_score",
    "interpretation",
  ],
  filters: [
    { key: "dateRange", label: "Date", type: "dateRange", field: "created_at" },
    {
      key: "questionnaire_id",
      label: "Questionnaire",
      type: "select",
      optionsSource: "questionnaires",
    },
    { key: "patient_id", label: "Patient", type: "select", optionsSource: "patients" },
  ],
  groupableKeys: [
    "questionnaire_title",
    "interpretation",
    "patient_name",
    "created_at",
  ],
  sortableKeys: ["created_at", "total_score", "patient_name", "questionnaire_title"],
  defaultSort: { key: "created_at", dir: "desc" },
  summable: [{ key: "total_score", agg: "avg" }],
};

const sessionUtilization = {
  key: "sessionUtilization",
  label: "Session Utilization",
  sheetName: "Session Utilization",
  columns: [
    { key: "patient_id", label: "ID", type: "number", width: 8 },
    { key: "patient_name", label: "Patient", type: "string", width: 24 },
    { key: "patient_ic", label: "Patient IC", type: "string", width: 18 },
    { key: "parent_name", label: "Parent", type: "string", width: 24 },
    { key: "treatment_type", label: "Treatment Type", type: "string", width: 16 },
    { key: "available_session", label: "Sessions Remaining", type: "number", width: 16 },
    { key: "sessions_booked", label: "Sessions Booked", type: "number", width: 14 },
    { key: "sessions_completed", label: "Sessions Completed", type: "number", width: 16 },
    { key: "last_session_date", label: "Last Session", type: "date", width: 14 },
    { key: "status", label: "Status", type: "string", width: 12 },
  ],
  defaultColumns: [
    "patient_name",
    "parent_name",
    "treatment_type",
    "available_session",
    "sessions_booked",
    "sessions_completed",
    "last_session_date",
    "status",
  ],
  filters: [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "ACTIVE", label: "Active" },
        { value: "INACTIVE", label: "Inactive" },
      ],
    },
    {
      key: "treatment_type",
      label: "Treatment Type",
      type: "select",
      options: [
        { value: "Centre", label: "Centre" },
        { value: "Online", label: "Online" },
        { value: "In House", label: "In House" },
      ],
    },
  ],
  groupableKeys: ["treatment_type", "status", "parent_name"],
  sortableKeys: [
    "patient_name",
    "available_session",
    "sessions_booked",
    "sessions_completed",
    "last_session_date",
  ],
  defaultSort: { key: "patient_name", dir: "asc" },
  summable: [
    { key: "available_session", agg: "sum" },
    { key: "sessions_booked", agg: "sum" },
    { key: "sessions_completed", agg: "sum" },
  ],
};

export const reportDefinitions = {
  appointments,
  payment,
  invoices,
  screening,
  sessionUtilization,
  practitioners,
  patients,
  therapyServices,
};

export function getReportDefinition(entity) {
  return reportDefinitions[entity] || null;
}

export function getReportEntities() {
  return Object.values(reportDefinitions).map((d) => ({
    value: d.key,
    label: d.label,
  }));
}

export function getColumnLabel(def, key) {
  const col = def?.columns?.find((c) => c.key === key);
  return col ? col.label : key;
}
