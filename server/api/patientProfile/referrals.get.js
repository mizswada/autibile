import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Helper to map DB referral to frontend structure
function mapReferral(referral) {
  return {
    id: referral.referrals_id,
    recipient: referral.referrals_recepient,
    hospital: referral.hospital,
    date: referral.referrals_date
      ? new Date(referral.referrals_date).toISOString().slice(0, 10)
      : '',
    diagnosis: referral.diagnosis ? referral.diagnosis.split(',').map(s => s.trim()).filter(Boolean) : [],
    reason: referral.refferrals_reason,
    notes: referral.notes,
    history: {
      presentingConcerns: referral.history_presentingConcerns || '',
      developmentalMilestone: referral.history_developmentalMilestone || '',
      behavioralConcerns: referral.history_behavioralConcerns || '',
      medicalHistory: referral.history_medicalHistory || '',
      medicationAllergies: referral.history_medication || '',
      familySocialBackground: referral.history_family || '',
      otherHistory: referral.history_other || ''
    },
    physicalExamination: referral.physical_examination || '',
    generalAppearance: referral.general_appearance || '',
    systemicExamination: referral.systemic_examination
      ? referral.systemic_examination.split(',').map(s => s.trim()).filter(Boolean)
      : [],
    customSystemic: '', // Not stored in DB, default to ''
    currentMedications: referral.current_medications || 'No',
    medicationDetails: referral.medicationDetails || ''
  };
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const patientId = query.patientId;

    // If id is present, fetch a single referral
    if (query.id) {
      const referral = await prisma.referrals.findUnique({
        where: { referrals_id: parseInt(query.id) }
      });
      if (referral) {
        return { statusCode: 200, data: mapReferral(referral) };
      } else {
        return { statusCode: 404, message: 'Referral not found' };
      }
    }

    if (!patientId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Patient ID is required'
      });
    }

    // Fetch referrals from the database
    const patientReferrals = await prisma.referrals.findMany({
      where: { patient_id: parseInt(patientId) },
      orderBy: { referrals_date: 'desc' }
    });

    return {
      statusCode: 200,
      data: patientReferrals.map(mapReferral)
    };

  } catch (error) {
    console.error('Error fetching referrals:', error);
    return {
      statusCode: 500,
      data: [],
      message: 'Failed to fetch referrals'
    };
  }
});