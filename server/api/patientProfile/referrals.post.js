import prisma from "~/server/utils/prisma";
import { findActivePatient } from "~/server/utils/activeEntities";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const {
      patientId,
      recipient,
      hospital,
      date,
      diagnosis,
      reason,
      notes,
      history,
      physicalExamination,
      generalAppearance,
      systemicExamination,
      currentMedications,
      medicationDetails
    } = body;

    // Validate required fields
    if (!patientId || !recipient || !hospital || !date || !reason) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: patientId, recipient, hospital, date, and reason are required'
      });
    }

    const patient = await findActivePatient(prisma, patientId, {
      patient_id: true,
    });

    if (!patient) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Patient not found or inactive'
      });
    }

    const newReferral = await prisma.referrals.create({
      data: {
        patient_id: parseInt(patientId),
        referrals_recepient: recipient,
        hospital,
        referrals_date: new Date(date),
        diagnosis: Array.isArray(diagnosis) ? diagnosis.join(', ') : '',
        refferrals_reason: reason,
        history_presentingConcerns: history?.presentingConcerns || '',
        history_developmentalMilestone: history?.developmentalMilestone || '',
        history_behavioralConcerns: history?.behavioralConcerns || '',
        history_medicalHistory: history?.medicalHistory || '',
        history_medication: history?.medicationAllergies || '',
        history_family: history?.familySocialBackground || '',
        history_other: history?.otherHistory || '',
        physical_examination: physicalExamination || '',
        general_appearance: generalAppearance || '',
        systemic_examination: Array.isArray(systemicExamination) ? systemicExamination.join(', ') : '',
        current_medications: currentMedications || 'No',
        notes: notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    });

    return {
      statusCode: 201,
      data: newReferral,
      message: 'Referral created successfully'
    };

  } catch (error) {
    console.error('Error creating referral:', error);
    return {
      statusCode: 500,
      data: null,
      message: 'Failed to create referral',
      debug: error?.message || error
    };
  }
});