import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const patientId = query.patientId;

    if (!patientId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Patient ID is required'
      });
    }

    // Mock data for doctor referrals
    const mockReferrals = [
      {
        id: 1,
        patientId: parseInt(patientId),
        recipient: 'Consultant Paediatrician',
        hospital: 'General Hospital Kuala Lumpur',
        date: '2024-01-15',
        diagnosis: ['Autism Spectrum Disorder', 'Developmental Delay'],
        reason: 'Assessment and intervention for speech and language delay',
        notes: 'Patient shows signs of social communication difficulties and repetitive behaviors. Recommend comprehensive evaluation.',
        history: {
          presentingConcerns: 'Speech delay',
          developmentalMilestone: 'Delayed walking',
          behavioralConcerns: 'Repetitive behaviors',
          medicalHistory: 'No major illness',
          medicationAllergies: 'None',
          familySocialBackground: 'Supportive family',
          otherHistory: 'NA'
        },
        physicalExamination: 'Normal',
        generalAppearance: 'Alert, cooperative',
        systemicExamination: ['Neurology'],
        currentMedications: 'No',
        medicationDetails: ''
      },
      {
        id: 2,
        patientId: parseInt(patientId),
        recipient: 'Child Psychiatrist',
        hospital: 'University Malaya Medical Centre',
        date: '2024-02-20',
        diagnosis: ['ADHD'],
        reason: 'Behavioural management',
        notes: 'Patient responding well to current therapy. Consider adjusting medication dosage based on recent assessments.',
        history: {
          presentingConcerns: 'Hyperactivity',
          developmentalMilestone: 'Normal',
          behavioralConcerns: 'Impulsivity',
          medicalHistory: 'Asthma',
          medicationAllergies: 'Salbutamol',
          familySocialBackground: 'Single parent',
          otherHistory: 'NA'
        },
        physicalExamination: 'NA',
        generalAppearance: 'Restless',
        systemicExamination: ['Neurology', 'Other'],
        currentMedications: 'Yes',
        medicationDetails: 'Methylphenidate 10mg OD'
      },
      {
        id: 3,
        patientId: parseInt(patientId),
        recipient: 'Occupational Therapist',
        hospital: 'National Autism Society Malaysia',
        date: '2024-03-10',
        diagnosis: ['Sensory Processing Disorder'],
        reason: 'Sensory integration therapy',
        notes: 'Patient shows improvement in fine motor skills. Continue with current therapy plan and add new exercises.',
        history: {
          presentingConcerns: 'Sensory issues',
          developmentalMilestone: 'Normal',
          behavioralConcerns: 'NA',
          medicalHistory: 'NA',
          medicationAllergies: 'NA',
          familySocialBackground: 'NA',
          otherHistory: 'NA'
        },
        physicalExamination: 'NA',
        generalAppearance: 'NA',
        systemicExamination: [],
        currentMedications: 'No',
        medicationDetails: ''
      }
    ];

    // Filter referrals for the specific patient
    const patientReferrals = mockReferrals.filter(referral => referral.patientId === parseInt(patientId));

    return {
      statusCode: 200,
      data: patientReferrals
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