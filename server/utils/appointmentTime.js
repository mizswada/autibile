export const BUSINESS_START_HOUR = 8;
export const BUSINESS_END_HOUR = 18;
export const INTERVAL_MINUTES = 30;

export function normalizeTimeString(time) {
  if (!time) return null;
  if (time instanceof Date) {
    return fromPrismaTime(time);
  }

  const value = String(time).trim();
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

export function timeToMinutes(time) {
  const normalized = normalizeTimeString(time);
  if (!normalized) return null;

  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

export function isValidIntervalTime(time) {
  const normalized = normalizeTimeString(time);
  if (!normalized) return false;

  const minutes = timeToMinutes(normalized);
  if (minutes === null) return false;

  const [, minutePart] = normalized.split(":").map(Number);
  if (minutePart !== 0 && minutePart !== 30) return false;

  return (
    minutes >= BUSINESS_START_HOUR * 60 &&
    minutes <= BUSINESS_END_HOUR * 60
  );
}

export function generateStartTimes() {
  const times = [];
  for (
    let minutes = BUSINESS_START_HOUR * 60;
    minutes <= BUSINESS_END_HOUR * 60;
    minutes += INTERVAL_MINUTES
  ) {
    times.push(minutesToTime(minutes));
  }
  return times;
}

export function generateEndTimeOptions(startTime) {
  const startMinutes = timeToMinutes(startTime);
  if (startMinutes === null) return [];

  const options = [];
  for (
    let minutes = startMinutes + INTERVAL_MINUTES;
    minutes <= BUSINESS_END_HOUR * 60;
    minutes += INTERVAL_MINUTES
  ) {
    options.push(minutesToTime(minutes));
  }
  return options;
}

function buildAvailabilitySlot(value, isAvailable) {
  return {
    value,
    label: formatTime12h(value),
    isAvailable,
  };
}

export function getAvailableEndTimesForStart(
  startTime,
  existingAppointments,
  { isAdminBooking = false } = {},
) {
  const normalizedStart = normalizeTimeString(startTime);
  if (!normalizedStart || !isValidIntervalTime(normalizedStart)) {
    return [];
  }

  return generateEndTimeOptions(normalizedStart).map((endTime) =>
    buildAvailabilitySlot(
      endTime,
      isAdminBooking ||
        !hasOverlapWithAppointments(
          existingAppointments,
          normalizedStart,
          endTime,
        ),
    ),
  );
}

export function getAvailableStartTimesForCustom(
  existingAppointments,
  { isAdminBooking = false } = {},
) {
  return generateStartTimes().map((startTime) => {
    if (isAdminBooking) {
      return buildAvailabilitySlot(startTime, true);
    }

    const endOptions = getAvailableEndTimesForStart(
      startTime,
      existingAppointments,
    );
    const hasAvailableEnd = endOptions.some((option) => option.isAvailable);

    return buildAvailabilitySlot(startTime, hasAvailableEnd);
  });
}

export function getAvailableStartTimes(
  existingAppointments,
  durationType,
  customEndTime,
  { isAdminBooking = false } = {},
) {
  if (durationType === "custom") {
    return getAvailableStartTimesForCustom(existingAppointments, {
      isAdminBooking,
    });
  }

  return generateStartTimes().map((startTime) => {
    if (isAdminBooking) {
      return buildAvailabilitySlot(startTime, true);
    }

    let endTime;
    try {
      endTime = computeEndTime(
        startTime,
        durationType || "30min",
        customEndTime,
      );
    } catch {
      return buildAvailabilitySlot(startTime, false);
    }

    return buildAvailabilitySlot(
      startTime,
      !hasOverlapWithAppointments(
        existingAppointments,
        startTime,
        endTime,
      ),
    );
  });
}

export function computeEndTime(startTime, durationType, customEndTime) {
  const normalizedStart = normalizeTimeString(startTime);
  if (!isValidIntervalTime(normalizedStart)) {
    throw new Error("Invalid start time. Use 30-minute intervals between 8:00 AM and 6:00 PM.");
  }

  const startMinutes = timeToMinutes(normalizedStart);

  if (durationType === "30min") {
    return minutesToTime(startMinutes + 30);
  }

  if (durationType === "1hour") {
    return minutesToTime(startMinutes + 60);
  }

  if (durationType === "custom") {
    const normalizedEnd = normalizeTimeString(customEndTime);
    if (!isValidIntervalTime(normalizedEnd)) {
      throw new Error("Invalid end time. Use 30-minute intervals between 8:00 AM and 6:00 PM.");
    }

    const endMinutes = timeToMinutes(normalizedEnd);
    if (endMinutes <= startMinutes) {
      throw new Error("End time must be after start time.");
    }

    return normalizedEnd;
  }

  throw new Error("Invalid duration type.");
}

export function rangesOverlap(startA, endA, startB, endB) {
  const startMinutesA = timeToMinutes(startA);
  const endMinutesA = timeToMinutes(endA);
  const startMinutesB = timeToMinutes(startB);
  const endMinutesB = timeToMinutes(endB);

  if (
    [startMinutesA, endMinutesA, startMinutesB, endMinutesB].some(
      (value) => value === null,
    )
  ) {
    return false;
  }

  return startMinutesA < endMinutesB && startMinutesB < endMinutesA;
}

export function fromPrismaTime(value) {
  if (!value) return null;
  if (typeof value === "string") {
    return normalizeTimeString(value);
  }

  const hours = value.getUTCHours().toString().padStart(2, "0");
  const minutes = value.getUTCMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function toPrismaTime(timeStr) {
  const normalized = normalizeTimeString(timeStr);
  if (!normalized) return null;

  const [hours, minutes] = normalized.split(":").map(Number);
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
}

export function toSqlTime(timeStr) {
  const normalized = normalizeTimeString(timeStr);
  if (!normalized) return null;
  return `${normalized}:00`;
}

export async function persistAppointmentTimes(
  prisma,
  appointmentId,
  startTime,
  endTime,
) {
  const startSql = toSqlTime(startTime);
  const endSql = toSqlTime(endTime);

  if (!startSql || !endSql) {
    throw new Error("Invalid appointment time");
  }

  await prisma.$executeRaw`
    UPDATE appointments
    SET start_time = ${startSql}, end_time = ${endSql}
    WHERE appointment_id = ${parseInt(appointmentId, 10)}
  `;
}

export function parseLegacySlotTitle(title) {
  if (!title) return null;

  const timeRangeMatch = title.match(/(\d{1,2}\.\d{2})\s*(am|pm)/gi);
  if (!timeRangeMatch || timeRangeMatch.length < 2) return null;

  return {
    start_time: convertLegacyTimeTo24Hour(timeRangeMatch[0]),
    end_time: convertLegacyTimeTo24Hour(timeRangeMatch[1]),
  };
}

function convertLegacyTimeTo24Hour(timeStr) {
  const match = timeStr.match(/(\d{1,2})\.(\d{2})\s*(am|pm)/i);
  if (!match) return "09:00";

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3].toLowerCase();

  if (period === "pm" && hours !== 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, "0")}:${minutes}`;
}

export function getAppointmentTimes(appointment) {
  const startFromColumn = fromPrismaTime(appointment?.start_time);
  const endFromColumn = fromPrismaTime(appointment?.end_time);

  if (startFromColumn && endFromColumn) {
    return {
      start_time: startFromColumn,
      end_time: endFromColumn,
    };
  }

  const legacyTimes = parseLegacySlotTitle(appointment?.lookup?.title);
  if (legacyTimes) {
    return legacyTimes;
  }

  return {
    start_time: "09:00",
    end_time: "10:00",
  };
}

export function formatTime12h(time24) {
  const normalized = normalizeTimeString(time24);
  if (!normalized) return "";

  const [hourPart, minutePart] = normalized.split(":").map(Number);
  const period = hourPart >= 12 ? "PM" : "AM";
  const hour12 = hourPart % 12 || 12;
  return `${hour12}:${minutePart.toString().padStart(2, "0")} ${period}`;
}

export function formatTimeSlotLabel(startTime, endTime) {
  return `${formatTime12h(startTime)} - ${formatTime12h(endTime)}`;
}

export function inferDurationType(startTime, endTime) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (startMinutes === null || endMinutes === null) {
    return "1hour";
  }

  const diff = endMinutes - startMinutes;
  if (diff === 30) return "30min";
  if (diff === 60) return "1hour";
  return "custom";
}

export function toDateOnlyString(date) {
  if (!date) return null;
  if (typeof date === "string") return date.split("T")[0];

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseAppointmentDate(dateInput) {
  const dateStr = toDateOnlyString(dateInput);
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function mapRawAppointmentRow(row) {
  return {
    appointment_id: Number(row.appointment_id),
    patient_id: row.patient_id != null ? Number(row.patient_id) : null,
    practitioner_id:
      row.practitioner_id != null ? Number(row.practitioner_id) : null,
    date: row.date,
    slot_ID: row.slot_ID != null ? Number(row.slot_ID) : null,
    status: row.status != null ? Number(row.status) : null,
    start_time: row.start_time || null,
    end_time: row.end_time || null,
    lookup: row.lookup_title ? { title: row.lookup_title } : null,
  };
}

export async function getPractitionerAppointmentsForDate(
  prisma,
  practitionerId,
  date,
  excludeAppointmentId = null,
) {
  const practitionerIdInt = parseInt(practitionerId, 10);
  const dateStr = toDateOnlyString(date);

  const rows = excludeAppointmentId
    ? await prisma.$queryRaw`
        SELECT
          a.appointment_id,
          a.patient_id,
          a.practitioner_id,
          a.date,
          a.slot_ID,
          a.status,
          TIME_FORMAT(a.start_time, '%H:%i') AS start_time,
          TIME_FORMAT(a.end_time, '%H:%i') AS end_time,
          l.title AS lookup_title
        FROM appointments a
        LEFT JOIN lookup l ON a.slot_ID = l.lookupID
        WHERE a.practitioner_id = ${practitionerIdInt}
          AND a.date = ${dateStr}
          AND a.deleted_at IS NULL
          AND a.status != 37
          AND a.appointment_id != ${parseInt(excludeAppointmentId, 10)}
      `
    : await prisma.$queryRaw`
        SELECT
          a.appointment_id,
          a.patient_id,
          a.practitioner_id,
          a.date,
          a.slot_ID,
          a.status,
          TIME_FORMAT(a.start_time, '%H:%i') AS start_time,
          TIME_FORMAT(a.end_time, '%H:%i') AS end_time,
          l.title AS lookup_title
        FROM appointments a
        LEFT JOIN lookup l ON a.slot_ID = l.lookupID
        WHERE a.practitioner_id = ${practitionerIdInt}
          AND a.date = ${dateStr}
          AND a.deleted_at IS NULL
          AND a.status != 37
      `;

  return rows.map(mapRawAppointmentRow);
}

export async function attachAppointmentTimes(prisma, appointment) {
  if (!appointment?.appointment_id) return appointment;

  const rows = await prisma.$queryRaw`
    SELECT
      TIME_FORMAT(start_time, '%H:%i') AS start_time,
      TIME_FORMAT(end_time, '%H:%i') AS end_time
    FROM appointments
    WHERE appointment_id = ${parseInt(appointment.appointment_id, 10)}
  `;

  if (rows[0]) {
    appointment.start_time = rows[0].start_time;
    appointment.end_time = rows[0].end_time;
  }

  return appointment;
}

export function hasOverlapWithAppointments(appointments, startTime, endTime) {
  return appointments.some((appointment) => {
    const { start_time, end_time } = getAppointmentTimes(appointment);
    return rangesOverlap(startTime, endTime, start_time, end_time);
  });
}

export async function findOverlappingAppointment(
  prisma,
  { practitionerId, date, startTime, endTime, excludeAppointmentId },
) {
  const appointments = await getPractitionerAppointmentsForDate(
    prisma,
    practitionerId,
    date,
    excludeAppointmentId,
  );

  if (!hasOverlapWithAppointments(appointments, startTime, endTime)) {
    return null;
  }

  return appointments.find((appointment) => {
    const { start_time, end_time } = getAppointmentTimes(appointment);
    return rangesOverlap(startTime, endTime, start_time, end_time);
  });
}

export function formatAppointmentCalendarEvent(appointment, sessionNumber = 1) {
  const isAdminAppointment = appointment.practitioner_id === null;
  const { start_time, end_time } = getAppointmentTimes(appointment);

  const patientName = appointment.user_patients?.fullname || "Unknown Patient";
  const serviceName = appointment.service?.name || "Unknown Service";
  const title = `${patientName} - ${serviceName} (Session ${sessionNumber})`;

  let practitionerName = "Admin";
  if (appointment.user_practitioners?.user?.userFullName) {
    practitionerName = appointment.user_practitioners.user.userFullName;
  }

  const slotTitle = isAdminAppointment
    ? `Admin - ${formatTimeSlotLabel(start_time, end_time)}`
    : formatTimeSlotLabel(start_time, end_time);

  const datePart = appointment.date.toISOString().split("T")[0];

  return {
    id: appointment.appointment_id,
    title,
    start: `${datePart}T${start_time}:00`,
    end: `${datePart}T${end_time}:00`,
    extendedProps: {
      patient_id: appointment.patient_id,
      patient_name: appointment.user_patients?.fullname,
      practitioner_id: appointment.practitioner_id,
      practitioner_name: practitionerName,
      service_id: appointment.service_id,
      service_name: appointment.service?.name,
      status: appointment.status,
      booked_by: appointment.book_by,
      time_slot: slotTitle,
      start_time,
      end_time,
      parent_comment: appointment.parent_comment,
      therapist_doctor_comment: appointment.therapist_doctor_comment,
      parent_rate: appointment.parent_rate,
      slot_ID: appointment.slot_ID,
      session_number: sessionNumber,
      is_admin_appointment: isAdminAppointment,
      deleted_at: appointment.deleted_at ?? null,
    },
  };
}
