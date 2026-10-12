/**
 * Upcoming booked appointments of a practitioner that is being deactivated or removed.
 *
 * They are NOT cancelled (the patient keeps the session and any billing link). They are
 * unassigned instead: with no practitioner they become "admin appointments", which the
 * calendar already shows as waiting to be assigned to a doctor / therapist.
 */
const BOOKED = 36;

function upcomingWhere(practitionerIds) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return {
    practitioner_id: { in: practitionerIds },
    deleted_at: null,
    status: BOOKED,
    date: { gte: today },
  };
}

export function countUpcomingAppointments(db, practitionerIds) {
  return db.appointments.count({ where: upcomingWhere(practitionerIds) });
}

export async function unassignUpcomingAppointments(db, practitionerIds) {
  const result = await db.appointments.updateMany({
    where: upcomingWhere(practitionerIds),
    data: { practitioner_id: null, updated_at: new Date() },
  });
  return result.count;
}

/** Practitioner records of a login account that a deletion request would remove. */
export async function practitionerIdsOfUser(db, userId, accountType) {
  const rows = await db.user_practitioners.findMany({
    where: {
      user_id: userId,
      deleted_at: null,
      ...(accountType === "Doctor" || accountType === "Therapist" ? { type: accountType } : {}),
    },
    select: { practitioner_id: true },
  });
  return rows.map((row) => row.practitioner_id);
}
