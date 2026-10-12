import prisma from "~/server/utils/prisma";
import {
  findLinkedActivePatient,
  isActiveStatus,
} from "~/server/utils/activeEntities";
import { getMaxUnbilled } from "~/server/utils/sessionBalance";
import { isAdminRequest } from "~/server/utils/reports/guard";

export default defineEventHandler(async (event) => {
  try {
    if (!event.context.user?.userID) {
      return { statusCode: 401, success: false, message: "Unauthorized: please log in." };
    }
    const query = getQuery(event);

    const { patient_id } = query;

    if (!patient_id) {
      return {
        success: false,
        message: 'Patient ID is required'
      };
    }

    // Get patient information including available sessions
    const patient = await findLinkedActivePatient(prisma, patient_id, {
      patient_id: true,
      fullname: true,
      available_session: true,
      status: true,
    });

    if (!patient) {
      return {
        success: false,
        message:
          'Patient not found, inactive, or not linked to an active parent',
      };
    }

    // The balance can go below zero (owed / unbilled sessions) up to the admin-set cap.
    const balance = patient.available_session || 0;
    // Only administrators may book on credit; everyone else needs a prepaid session.
    const isAdmin = isAdminRequest(event);
    const maxUnbilled = isAdmin ? await getMaxUnbilled(prisma) : 0;
    const balanceAfter = balance - 1;
    const withinCap = balanceAfter >= 0 - maxUnbilled;
    const canBookAppointment = withinCap && isActiveStatus(patient.status);
    const willBeUnbilled = balance <= 0;

    let message;
    if (!canBookAppointment) {
      message =
        maxUnbilled === 0
          ? `Patient has no available sessions (${Math.max(0, balance)}). Cannot book appointment.`
          : `Patient has reached the limit of ${maxUnbilled} unbilled session(s). Cannot book appointment.`;
    } else if (willBeUnbilled) {
      message = 'Patient has no sessions left. This booking will be marked unbilled and the clinic admin will bill it.';
    } else {
      message = `Patient has ${balance} available session(s)`;
    }

    return {
      success: true,
      data: {
        patient_id: patient.patient_id,
        patient_name: patient.fullname,
        available_sessions: Math.max(0, balance),
        owed_sessions: Math.max(0, -balance),
        sessions_after_booking: Math.max(0, balanceAfter),
        owed_after_booking: Math.max(0, -balanceAfter),
        max_unbilled: maxUnbilled,
        will_be_unbilled: willBeUnbilled,
        can_book_appointment: canBookAppointment,
        status: patient.status
      },
      message
    };
  } catch (error) {
    console.error('Error checking patient sessions:', error);
    return {
      success: false,
      message: 'Failed to check patient sessions',
      error: error.message
    };
  }
});
