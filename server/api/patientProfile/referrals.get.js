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
    // In a real implementation, you would fetch from the database
    const mockReferrals = [
      {
        id: 1,
        patientId: parseInt(patientId),
        doctorName: 'Dr. Sarah Johnson',
        specialty: 'Pediatric Neurology',
        hospital: 'General Hospital Kuala Lumpur',
        date: '2024-01-15',
        followUpDate: '2024-02-15',
        reason: 'Assessment for autism spectrum disorder and developmental delays',
        notes: 'Patient shows signs of social communication difficulties and repetitive behaviors. Recommend comprehensive evaluation.',
        status: 'Completed'
      },
      {
        id: 2,
        patientId: parseInt(patientId),
        doctorName: 'Dr. Michael Chen',
        specialty: 'Child Psychiatry',
        hospital: 'University Malaya Medical Centre',
        date: '2024-02-20',
        followUpDate: '2024-03-20',
        reason: 'Behavioral therapy consultation and medication review',
        notes: 'Patient responding well to current therapy. Consider adjusting medication dosage based on recent assessments.',
        status: 'In Progress'
      },
      {
        id: 3,
        patientId: parseInt(patientId),
        doctorName: 'Dr. Aisha Rahman',
        specialty: 'Occupational Therapy',
        hospital: 'National Autism Society Malaysia',
        date: '2024-03-10',
        followUpDate: '2024-04-10',
        reason: 'Sensory integration therapy and motor skills development',
        notes: 'Patient shows improvement in fine motor skills. Continue with current therapy plan and add new exercises.',
        status: 'Scheduled'
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