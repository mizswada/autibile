import { PrismaClient } from "@prisma/client";

const prisma = globalThis.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

const MCHATR_QUESTIONNAIRE_ID = 1;
const MCHATR_F_QUESTIONNAIRE_ID = 2;

function isAccessEnabled(status) {
  return status === "Enable" || status === null || status === undefined;
}

function isMissingAccessTableError(error) {
  const code = error?.code;
  const message = String(error?.message || "");
  return (
    code === "P2021" ||
    code === "P2010" ||
    message.includes("patient_questionnaire_access") ||
    message.includes("does not exist") ||
    message.includes("doesn't exist")
  );
}

async function getMchatrResponse(patientId) {
  return prisma.questionnaires_responds.findFirst({
    where: {
      questionnaire_id: MCHATR_QUESTIONNAIRE_ID,
      patient_id: patientId,
    },
    orderBy: { created_at: "desc" },
  });
}

async function getAccessRecord(patientId, questionnaireId) {
  try {
    return await prisma.patient_questionnaire_access.findUnique({
      where: {
        patient_id_questionnaire_id: {
          patient_id: patientId,
          questionnaire_id: questionnaireId,
        },
      },
    });
  } catch (error) {
    if (isMissingAccessTableError(error)) {
      return null;
    }
    throw error;
  }
}

async function getAccessStatus(patientId, questionnaireId) {
  const record = await getAccessRecord(patientId, questionnaireId);
  if (record) {
    return record.access_status;
  }

  if (questionnaireId === MCHATR_QUESTIONNAIRE_ID) {
    const patient = await prisma.user_patients.findUnique({
      where: { patient_id: patientId },
      select: { mchatr_status: true },
    });
    return patient?.mchatr_status ?? "Enable";
  }

  return "Enable";
}

async function syncLegacyMchatrStatus(patientId, accessStatus) {
  await prisma.user_patients.update({
    where: { patient_id: patientId },
    data: {
      mchatr_status: accessStatus,
      update_at: new Date(),
    },
  });
}

async function setAccessStatus(patientId, questionnaireId, accessStatus) {
  try {
    const updated = await prisma.patient_questionnaire_access.upsert({
      where: {
        patient_id_questionnaire_id: {
          patient_id: patientId,
          questionnaire_id: questionnaireId,
        },
      },
      create: {
        patient_id: patientId,
        questionnaire_id: questionnaireId,
        access_status: accessStatus,
        updated_at: new Date(),
      },
      update: {
        access_status: accessStatus,
        updated_at: new Date(),
      },
    });

    if (questionnaireId === MCHATR_QUESTIONNAIRE_ID) {
      await syncLegacyMchatrStatus(patientId, accessStatus);
    }

    return updated;
  } catch (error) {
    if (
      isMissingAccessTableError(error) &&
      questionnaireId === MCHATR_QUESTIONNAIRE_ID
    ) {
      await syncLegacyMchatrStatus(patientId, accessStatus);
      return {
        patient_id: patientId,
        questionnaire_id: questionnaireId,
        access_status: accessStatus,
      };
    }

    if (isMissingAccessTableError(error)) {
      console.warn(
        "[questionnaireAccess] patient_questionnaire_access table missing; skipping lock for questionnaire",
        questionnaireId,
      );
      return {
        patient_id: patientId,
        questionnaire_id: questionnaireId,
        access_status: accessStatus,
      };
    }

    throw error;
  }
}

async function lockAfterSubmit(patientId, questionnaireId) {
  return setAccessStatus(patientId, questionnaireId, "Disable");
}

async function getQuestionnaireAccessInfo(patientId, questionnaireId) {
  const accessStatus = await getAccessStatus(patientId, questionnaireId);
  const accessEnabled = isAccessEnabled(accessStatus);

  const existingResponse = await prisma.questionnaires_responds.findFirst({
    where: {
      questionnaire_id: questionnaireId,
      patient_id: patientId,
    },
  });
  const hasCompleted = !!existingResponse;

  const mchatrResponse = await getMchatrResponse(patientId);
  const hasCompletedMchatr = !!mchatrResponse;
  const mchatrScore = mchatrResponse?.total_score ?? null;
  const isEligibleForQuestionnaire2 =
    mchatrScore !== null && mchatrScore >= 3 && mchatrScore <= 7;

  let canAccess = accessEnabled;
  let accessReason = accessEnabled
    ? hasCompleted
      ? "Patient can retake this questionnaire"
      : "Questionnaire is available"
    : "Questionnaire is locked. Contact admin to unlock.";

  if (questionnaireId === MCHATR_F_QUESTIONNAIRE_ID) {
    if (!hasCompletedMchatr) {
      canAccess = false;
      accessReason = "Patient must complete M-CHAT-R first.";
    } else if (!isEligibleForQuestionnaire2) {
      canAccess = false;
      accessReason =
        mchatrScore === null
          ? "Patient has not completed M-CHAT-R."
          : `M-CHAT-R score (${mchatrScore}) is not in eligible range 3-7.`;
    } else if (!accessEnabled) {
      canAccess = false;
      accessReason = "M-CHAT-R-F is locked. Contact admin to unlock.";
    }
  } else if (questionnaireId !== MCHATR_QUESTIONNAIRE_ID) {
    if (!hasCompletedMchatr) {
      canAccess = false;
      accessReason = "Complete M-CHAT-R screening first.";
    } else if (!accessEnabled) {
      canAccess = false;
      accessReason = "Questionnaire is locked. Contact admin to unlock.";
    }
  } else if (!accessEnabled) {
    canAccess = false;
    accessReason = "M-CHAT-R is locked. Contact admin to unlock.";
  }

  return {
    patient_id: patientId,
    questionnaire_id: questionnaireId,
    access_status: accessStatus,
    has_completed: hasCompleted,
    can_access: canAccess,
    access_reason: accessReason,
    has_completed_mchatr: hasCompletedMchatr,
    mchatr_score: mchatrScore,
    is_eligible_for_questionnaire_2: isEligibleForQuestionnaire2,
    can_retake: accessEnabled && hasCompleted,
  };
}

async function assertCanSubmit(patientId, questionnaireId) {
  const info = await getQuestionnaireAccessInfo(patientId, questionnaireId);
  if (!info.can_access) {
    return {
      allowed: false,
      message: info.access_reason || "Questionnaire is locked for this patient.",
    };
  }
  return { allowed: true };
}

async function getMchatrEligibility(patientId) {
  const patient = await prisma.user_patients.findUnique({
    where: { patient_id: patientId },
    select: { fullname: true },
  });

  const mchatrInfo = await getQuestionnaireAccessInfo(
    patientId,
    MCHATR_QUESTIONNAIRE_ID,
  );
  const mchatrFAccess = await getAccessStatus(
    patientId,
    MCHATR_F_QUESTIONNAIRE_ID,
  );
  const mchatrFEnabled = isAccessEnabled(mchatrFAccess);

  return {
    patient_id: patientId,
    patient_name: patient?.fullname,
    mchatr_status: mchatrInfo.access_status,
    has_completed_mchatr: mchatrInfo.has_completed_mchatr,
    is_eligible: mchatrInfo.can_access,
    can_take_mchatr: mchatrInfo.can_access,
    can_retake_mchatr: mchatrInfo.can_retake,
    mchatr_score: mchatrInfo.mchatr_score,
    is_eligible_for_questionnaire_2: mchatrInfo.is_eligible_for_questionnaire_2,
    can_take_questionnaire_2:
      mchatrInfo.is_eligible_for_questionnaire_2 && mchatrFEnabled,
  };
}

async function listAccessForPatient(patientId) {
  const questionnaires = await prisma.questionnaires.findMany({
    where: {
      deleted_at: null,
      hidden: { not: true },
    },
    select: {
      questionnaire_id: true,
      title: true,
    },
    orderBy: { questionnaire_id: "asc" },
  });

  return Promise.all(
    questionnaires.map(async (q) => {
      const info = await getQuestionnaireAccessInfo(
        patientId,
        q.questionnaire_id,
      );
      return {
        questionnaire_id: q.questionnaire_id,
        title: q.title,
        access_status: info.access_status,
        has_completed: info.has_completed,
        can_access: info.can_access,
        access_reason: info.access_reason,
      };
    }),
  );
}

export {
  MCHATR_QUESTIONNAIRE_ID,
  MCHATR_F_QUESTIONNAIRE_ID,
  isAccessEnabled,
  getAccessStatus,
  setAccessStatus,
  lockAfterSubmit,
  assertCanSubmit,
  getQuestionnaireAccessInfo,
  getMchatrEligibility,
  listAccessForPatient,
};
