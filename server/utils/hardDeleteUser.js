export const HARD_DELETE_PHRASE =
  "I confirm the hard-deletion of this user, and their data cannot be recovered";

const uniq = (list) => [...new Set(list)];
const lower = (value) => String(value || "").trim().toLowerCase();

/** What the admin must type (besides the sentence) to prove the right account. */
export function getConfirmIdentifier(user) {
  return user.userEmail || user.userUsername || String(user.userID);
}

/**
 * Builds the complete list of rows a hard delete would remove or change.
 * `db` is the prisma client or an interactive-transaction client, so the same
 * logic drives both the preview and the real delete.
 */
export async function collectDeletionPlan(db, userID) {
  const user = await db.user.findUnique({
    where: { userID },
    select: {
      userID: true,
      userFullName: true,
      userUsername: true,
      userEmail: true,
      userStatus: true,
      userCreatedDate: true,
      userrole: { select: { role: { select: { roleName: true } } } },
      user_parents: {
        select: { parent_id: true, parent_status: true, deleted_at: true },
      },
      user_practitioners: {
        select: { practitioner_id: true, status: true, type: true, deleted_at: true },
      },
    },
  });
  if (!user) return null;

  const roles = user.userrole.map((r) => r.role?.roleName).filter(Boolean);
  const parentIds = user.user_parents.map((p) => p.parent_id);
  const practitionerIds = user.user_practitioners.map((p) => p.practitioner_id);

  // Children: linked to one of this user's parent profiles, or owned by the user.
  const ownLinks = parentIds.length
    ? await db.user_parent_patient.findMany({
        where: { parent_id: { in: parentIds } },
        select: { patient_id: true },
      })
    : [];
  const owned = await db.user_patients.findMany({
    where: { user_id: userID },
    select: { patient_id: true },
  });
  const candidateIds = uniq([
    ...ownLinks.map((l) => l.patient_id),
    ...owned.map((o) => o.patient_id),
  ]);

  // Children also linked to a parent that is NOT being deleted are kept.
  const otherLinks = candidateIds.length
    ? await db.user_parent_patient.findMany({
        where: {
          patient_id: { in: candidateIds },
          ...(parentIds.length ? { parent_id: { notIn: parentIds } } : {}),
        },
        select: { patient_id: true, user_parents: { select: { user_id: true } } },
      })
    : [];
  const sharedMap = new Map();
  for (const link of otherLinks) {
    if (!sharedMap.has(link.patient_id)) {
      sharedMap.set(link.patient_id, link.user_parents?.user_id ?? null);
    }
  }
  const sharedIds = [...sharedMap.keys()];
  const deleteIds = candidateIds.filter((id) => !sharedMap.has(id));

  const ownedSet = new Set(owned.map((o) => o.patient_id));
  const reassign = sharedIds
    .filter((id) => ownedSet.has(id) && sharedMap.get(id))
    .map((id) => ({ patient_id: id, newOwnerUserID: sharedMap.get(id) }));

  const pick = (rows, key) => rows.map((r) => r[key]);

  const qrRows = deleteIds.length
    ? await db.questionnaires_responds.findMany({
        where: { patient_id: { in: deleteIds } },
        select: { qr_id: true },
      })
    : [];
  const qrIds = pick(qrRows, "qr_id");

  const apptByPatient = deleteIds.length
    ? await db.appointments.findMany({
        where: { patient_id: { in: deleteIds } },
        select: { appointment_id: true, status: true },
      })
    : [];
  const apptByPractitioner = practitionerIds.length
    ? await db.appointments.findMany({
        where: { practitioner_id: { in: practitionerIds } },
        select: { appointment_id: true, status: true },
      })
    : [];
  const apptBooked = await db.appointments.findMany({
    where: { book_by: userID },
    select: { appointment_id: true },
  });
  const apptDeleteIds = uniq([
    ...pick(apptByPatient, "appointment_id"),
    ...pick(apptByPractitioner, "appointment_id"),
  ]);
  const apptDeleteSet = new Set(apptDeleteIds);
  const apptUnbookIds = pick(apptBooked, "appointment_id").filter(
    (id) => !apptDeleteSet.has(id),
  );
  const patientApptSet = new Set(pick(apptByPatient, "appointment_id"));
  const apptOfOtherPatients = pick(apptByPractitioner, "appointment_id").filter(
    (id) => !patientApptSet.has(id),
  );
  const completedSessions = uniq([...apptByPatient, ...apptByPractitioner])
    .filter((a) => a.status === 41).length;

  const progressOr = [
    ...(deleteIds.length ? [{ patient_id: { in: deleteIds } }] : []),
    ...(practitionerIds.length ? [{ practitioner_id: { in: practitionerIds } }] : []),
  ];
  const progressRows = progressOr.length
    ? await db.progress_track.findMany({
        where: { OR: progressOr },
        select: { progress_id: true },
      })
    : [];
  const progressIds = pick(progressRows, "progress_id");

  const countByPatient = async (model) =>
    deleteIds.length ? db[model].count({ where: { patient_id: { in: deleteIds } } }) : 0;

  const payments = deleteIds.length
    ? await db.payment.findMany({
        where: { patient_id: { in: deleteIds } },
        select: { payment_id: true },
      })
    : [];
  const paymentNullRows = parentIds.length
    ? await db.payment.findMany({
        where: {
          parent_id: { in: parentIds },
          ...(deleteIds.length ? { patient_id: { notIn: deleteIds } } : {}),
        },
        select: { payment_id: true },
      })
    : [];

  const counts = {
    children_deleted: deleteIds.length,
    children_unlinked_only: sharedIds.length,
    appointments_deleted: apptDeleteIds.length,
    appointments_of_other_patients: apptOfOtherPatients.length,
    appointments_unbooked: apptUnbookIds.length,
    completed_sessions: completedSessions,
    questionnaire_responses: qrIds.length,
    questionnaire_answers: qrIds.length
      ? await db.questionnaires_questions_answers.count({ where: { qr_id: { in: qrIds } } })
      : 0,
    ai_results: qrIds.length
      ? await db.ai_analysis_results.count({ where: { qr_id: { in: qrIds } } })
      : 0,
    questionnaire_access: await countByPatient("patient_questionnaire_access"),
    diary_reports: await countByPatient("diary_report"),
    referrals: await countByPatient("referrals"),
    invoices: await countByPatient("invoice"),
    payments: payments.length,
    progress_notes: progressIds.length,
    account_requests: await db.account_requests.count({ where: { user_id: userID } }),
    parent_profiles: parentIds.length,
    practitioner_profiles: practitionerIds.length,
  };

  return {
    user,
    roles,
    parentIds,
    practitionerIds,
    deleteIds,
    sharedIds,
    reassign,
    qrIds,
    apptDeleteIds,
    apptUnbookIds,
    progressIds,
    paymentNullIds: pick(paymentNullRows, "payment_id"),
    counts,
  };
}

/** Reasons this account must not be hard-deleted right now. */
export function getBlockers(plan, adminUserID) {
  const blockers = [];
  const { user, roles } = plan;

  if (roles.some((r) => String(r).includes("Admin"))) {
    blockers.push("This is an administrator account. Admin accounts cannot be permanently deleted here.");
  }
  if (user.userID === adminUserID) {
    blockers.push("You cannot permanently delete your own account.");
  }
  if (lower(user.userStatus) !== "inactive") {
    blockers.push("Set this account to Inactive first, then try again.");
  }
  const activeParent = user.user_parents.some(
    (p) => lower(p.parent_status) === "active" && !p.deleted_at,
  );
  const activePractitioner = user.user_practitioners.some(
    (p) => lower(p.status) === "active" && !p.deleted_at,
  );
  if (activeParent || activePractitioner) {
    blockers.push("This account still has an active profile. Set it to Inactive first.");
  }
  return blockers;
}

export function getWarnings(plan) {
  const warnings = [];
  const c = plan.counts;
  if (c.payments > 0 || c.invoices > 0) {
    warnings.push(`${c.invoices} invoice(s) and ${c.payments} payment(s) will be erased.`);
  }
  if (c.completed_sessions > 0) {
    warnings.push(`${c.completed_sessions} completed session(s) will be erased.`);
  }
  if (c.appointments_of_other_patients > 0) {
    warnings.push(
      `${c.appointments_of_other_patients} appointment(s) belonging to OTHER patients are tied to this practitioner and will also be erased.`,
    );
  }
  if (c.children_unlinked_only > 0) {
    warnings.push(
      `${c.children_unlinked_only} child(ren) are shared with another parent. They will be kept and only unlinked from this account.`,
    );
  }
  return warnings;
}

export function buildPreview(plan, adminUserID) {
  const { user } = plan;
  return {
    target: {
      userID: user.userID,
      name: user.userFullName,
      username: user.userUsername,
      email: user.userEmail,
      status: user.userStatus,
      roles: plan.roles,
      createdAt: user.userCreatedDate,
    },
    blockers: getBlockers(plan, adminUserID),
    warnings: getWarnings(plan),
    counts: plan.counts,
    requiredPhrase: HARD_DELETE_PHRASE,
    confirmIdentifier: getConfirmIdentifier(user),
  };
}

/**
 * Permanently deletes the user and everything connected to them, plus the
 * audit row, in ONE transaction. Throws (rolling everything back) on any problem.
 */
export async function executeHardDelete(db, { userID, admin, ip }) {
  return db.$transaction(
    async (tx) => {
      const plan = await collectDeletionPlan(tx, userID);
      if (!plan) throw new Error("The user no longer exists.");

      const blockers = getBlockers(plan, admin.userID);
      if (blockers.length) throw new Error(blockers[0]);

      const { deleteIds, qrIds, parentIds, practitionerIds } = plan;

      if (deleteIds.length) {
        if (qrIds.length) {
          await tx.ai_analysis_results.deleteMany({ where: { qr_id: { in: qrIds } } });
          await tx.questionnaires_questions_answers.deleteMany({ where: { qr_id: { in: qrIds } } });
        }
        await tx.ai_analysis_results.deleteMany({ where: { patient_id: { in: deleteIds } } });
        await tx.questionnaires_responds.deleteMany({ where: { patient_id: { in: deleteIds } } });
        await tx.patient_questionnaire_access.deleteMany({ where: { patient_id: { in: deleteIds } } });
        await tx.diary_report.deleteMany({ where: { patient_id: { in: deleteIds } } });
        await tx.referrals.deleteMany({ where: { patient_id: { in: deleteIds } } });
        await tx.payment.deleteMany({ where: { patient_id: { in: deleteIds } } });
        await tx.invoice_item.deleteMany({ where: { invoice: { patient_id: { in: deleteIds } } } });
        await tx.invoice.deleteMany({ where: { patient_id: { in: deleteIds } } });
      }

      if (plan.progressIds.length) {
        await tx.progress_track.deleteMany({ where: { progress_id: { in: plan.progressIds } } });
      }
      if (plan.apptDeleteIds.length) {
        await tx.appointments.deleteMany({ where: { appointment_id: { in: plan.apptDeleteIds } } });
      }
      if (plan.apptUnbookIds.length) {
        await tx.appointments.updateMany({
          where: { appointment_id: { in: plan.apptUnbookIds } },
          data: { book_by: null },
        });
      }
      if (plan.paymentNullIds.length) {
        await tx.payment.updateMany({
          where: { payment_id: { in: plan.paymentNullIds } },
          data: { parent_id: null },
        });
      }

      // Shared children stay with their other parent; hand over ownership first.
      for (const item of plan.reassign) {
        await tx.user_patients.update({
          where: { patient_id: item.patient_id },
          data: { user_id: item.newOwnerUserID },
        });
      }

      if (parentIds.length || deleteIds.length) {
        await tx.user_parent_patient.deleteMany({
          where: {
            OR: [
              ...(parentIds.length ? [{ parent_id: { in: parentIds } }] : []),
              ...(deleteIds.length ? [{ patient_id: { in: deleteIds } }] : []),
            ],
          },
        });
      }
      if (deleteIds.length) {
        await tx.user_patients.deleteMany({ where: { patient_id: { in: deleteIds } } });
      }
      if (practitionerIds.length) {
        await tx.user_practitioners.deleteMany({ where: { practitioner_id: { in: practitionerIds } } });
      }
      if (parentIds.length) {
        await tx.user_parents.deleteMany({ where: { parent_id: { in: parentIds } } });
      }
      await tx.userrole.deleteMany({ where: { userRoleUserID: userID } });
      await tx.user_email_token.deleteMany({ where: { userID } });
      await tx.account_requests.deleteMany({ where: { user_id: userID } });
      await tx.user.delete({ where: { userID } });

      // Post-check: nothing of the target may remain.
      const leftovers = await Promise.all([
        tx.user.count({ where: { userID } }),
        tx.user_parents.count({ where: { user_id: userID } }),
        tx.user_practitioners.count({ where: { user_id: userID } }),
        tx.user_patients.count({ where: { user_id: userID } }),
        deleteIds.length
          ? tx.user_patients.count({ where: { patient_id: { in: deleteIds } } })
          : 0,
      ]);
      if (leftovers.some((n) => n > 0)) {
        throw new Error("Verification failed: some records were not removed. Nothing was deleted.");
      }

      await tx.user_deletion_audit.create({
        data: {
          deleted_user_id: userID,
          deleted_user_name: plan.user.userFullName,
          deleted_user_email: plan.user.userEmail,
          deleted_roles: plan.roles.join(", ").slice(0, 255),
          admin_user_id: admin.userID,
          admin_email: admin.email,
          ip: ip ? String(ip).slice(0, 64) : null,
          counts: JSON.stringify(plan.counts),
        },
      });

      return plan.counts;
    },
    { timeout: 60000, maxWait: 10000 },
  );
}
