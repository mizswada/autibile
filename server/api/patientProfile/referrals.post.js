import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

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

    const newReferral = await prisma.referrals.create({
      data: {
        id: Date.now(),
        patientId: parseInt(patientId),
        recipient,
        hospital,
        date,
        diagnosis: Array.isArray(diagnosis) ? diagnosis : [],
        reason,
        notes: notes || '',
        history: history || {},
        physicalExamination: physicalExamination || '',
        generalAppearance: generalAppearance || '',
        systemicExamination: Array.isArray(systemicExamination) ? systemicExamination : [],
        currentMedications: currentMedications || 'No',
        medicationDetails: currentMedications === 'Yes' ? medicationDetails || '' : '',
        createdAt: new Date().toISOString()
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
      message: 'Failed to create referral'
    };
  }
});