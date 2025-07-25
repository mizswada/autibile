import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const {
      id,
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

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: id'
      });
    }

    const updatedReferral = await prisma.referrals.update({
      where: { referrals_id: parseInt(id) },
      data: {
        referrals_recepient: recipient,
        hospital,
        referrals_date: date ? new Date(date) : undefined,
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
        updated_at: new Date().toISOString()
      }
    });

    return {
      statusCode: 200,
      data: updatedReferral,
      message: 'Referral updated successfully'
    };

  } catch (error) {
    console.error('Error updating referral:', error);
    return {
      statusCode: 500,
      data: null,
      message: 'Failed to update referral',
      debug: error?.message || error
    };
  }
}); 