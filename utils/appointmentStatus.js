/**
 * Single source of truth for appointment statuses (web client + server).
 *
 * Only three statuses are in use: Booked, Cancelled and Completed.
 * 38 (Started), 39 (Confirmed Start) and 40 (Finished) were retired; old rows
 * are migrated by prisma/migrations/simplify_appointment_status, and any stray
 * legacy value is still shown / saved as its modern equivalent through
 * `normalizeAppointmentStatus`.
 */

export const APPOINTMENT_STATUS_BOOKED = 36;
export const APPOINTMENT_STATUS_CANCELLED = 37;
export const APPOINTMENT_STATUS_COMPLETED = 41;

const LEGACY_STATUS_MAP = {
  38: APPOINTMENT_STATUS_BOOKED,
  39: APPOINTMENT_STATUS_BOOKED,
  40: APPOINTMENT_STATUS_COMPLETED,
};

/** Maps retired status codes to the status they became. Other values pass through. */
export function normalizeAppointmentStatus(status) {
  const code = Number(status);
  return LEGACY_STATUS_MAP[code] ?? code;
}

const STATUSES = {
  [APPOINTMENT_STATUS_BOOKED]: {
    value: APPOINTMENT_STATUS_BOOKED,
    label: 'Booked',
    badgeClass: 'bg-blue-100 text-blue-800',
    color: '#1976D2', // calendar event / legend
    pdfColor: '#2563EB',
    symbol: '○',
  },
  [APPOINTMENT_STATUS_CANCELLED]: {
    value: APPOINTMENT_STATUS_CANCELLED,
    label: 'Cancelled',
    badgeClass: 'bg-red-100 text-red-800',
    color: '#9CA3AF',
    pdfColor: '#DC2626',
    symbol: '✕',
  },
  [APPOINTMENT_STATUS_COMPLETED]: {
    value: APPOINTMENT_STATUS_COMPLETED,
    label: 'Completed',
    badgeClass: 'bg-green-100 text-green-800',
    color: '#2E7D32',
    pdfColor: '#16A34A',
    symbol: '✓',
  },
};

const UNKNOWN_STATUS = {
  value: null,
  label: 'Unknown',
  badgeClass: 'bg-gray-100 text-gray-800',
  color: '#6B7280',
  pdfColor: '#6B7280',
  symbol: '?',
};

/** Status metadata (label, badge class, colours) for any code, legacy ones included. */
export function getAppointmentStatus(status) {
  return STATUSES[normalizeAppointmentStatus(status)] || UNKNOWN_STATUS;
}

/**
 * Code -> metadata lookup for templates (`statusMapping[row.status]?.label`).
 * Retired codes resolve to the status they became.
 */
export const APPOINTMENT_STATUS_MAP = {
  ...STATUSES,
  38: STATUSES[APPOINTMENT_STATUS_BOOKED],
  39: STATUSES[APPOINTMENT_STATUS_BOOKED],
  40: STATUSES[APPOINTMENT_STATUS_COMPLETED],
};

/** The statuses an admin / practitioner can choose, in display order. */
export const APPOINTMENT_STATUS_LIST = [
  STATUSES[APPOINTMENT_STATUS_BOOKED],
  STATUSES[APPOINTMENT_STATUS_COMPLETED],
  STATUSES[APPOINTMENT_STATUS_CANCELLED],
];

/** FormKit select options (string values, as the forms already use). */
export const APPOINTMENT_STATUS_FORM_OPTIONS = APPOINTMENT_STATUS_LIST.map((s) => ({
  label: s.label,
  value: String(s.value),
}));
