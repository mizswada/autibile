/**
 * Shared Active / not-soft-deleted filters for patients, parents, practitioners.
 * Status values in this app are stored as "Active" / "Inactive".
 */

export const ACTIVE_STATUS = "Active";

export function activePatientWhere(extra = {}) {
  return {
    deleted_at: null,
    status: ACTIVE_STATUS,
    ...extra,
  };
}

export function activeParentWhere(extra = {}) {
  return {
    deleted_at: null,
    parent_status: ACTIVE_STATUS,
    ...extra,
  };
}

export function activePractitionerWhere(extra = {}) {
  return {
    deleted_at: null,
    status: ACTIVE_STATUS,
    ...extra,
  };
}

/** Active patient that still has at least one Active, non-deleted parent link. */
export function linkedActivePatientWhere(extra = {}) {
  return activePatientWhere({
    ...extra,
    user_parent_patient: {
      some: {
        user_parents: activeParentWhere(),
      },
    },
  });
}

export function isActiveStatus(status) {
  return String(status || "").toLowerCase() === "active";
}

/** Find an active (not soft-deleted) patient by id. */
export async function findActivePatient(db, patientId, select) {
  const id = parseInt(patientId, 10);
  if (Number.isNaN(id)) return null;

  return db.user_patients.findFirst({
    where: activePatientWhere({ patient_id: id }),
    ...(select ? { select } : {}),
  });
}

/**
 * Find an active patient who is linked to at least one Active parent.
 * Use this for booking / invoicing / business create flows.
 */
export async function findLinkedActivePatient(db, patientId, select) {
  const id = parseInt(patientId, 10);
  if (Number.isNaN(id)) return null;

  return db.user_patients.findFirst({
    where: linkedActivePatientWhere({ patient_id: id }),
    ...(select ? { select } : {}),
  });
}

/** Find an active (not soft-deleted) parent by id. */
export async function findActiveParent(db, parentId, select) {
  const id = parseInt(parentId, 10);
  if (Number.isNaN(id)) return null;

  return db.user_parents.findFirst({
    where: activeParentWhere({ parent_id: id }),
    ...(select ? { select } : {}),
  });
}

/** Find an active (not soft-deleted) practitioner by id. */
export async function findActivePractitioner(db, practitionerId, select) {
  const id = parseInt(practitionerId, 10);
  if (Number.isNaN(id)) return null;

  return db.user_practitioners.findFirst({
    where: activePractitionerWhere({ practitioner_id: id }),
    ...(select ? { select } : {}),
  });
}
