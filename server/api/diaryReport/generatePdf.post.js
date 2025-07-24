import { PrismaClient } from '@prisma/client';

export default defineEventHandler(async (event) => {
  const prisma = new PrismaClient();
  try {
    const body = await readBody(event);
    const { patientId } = body;
    
    if (!patientId) {
      return {
        statusCode: 400,
        message: 'Patient ID is required'
      };
    }
    
    // Fetch patient data
    const patient = await prisma.user_patients.findUnique({
      where: {
        patient_id: parseInt(patientId)
      }
    });
    
    if (!patient) {
      return {
        statusCode: 404,
        message: 'Patient not found'
      };
    }
    
    // Fetch parent data using the relationship table
    const parentRelationship = await prisma.user_parent_patient.findFirst({
      where: {
        patient_id: parseInt(patientId)
      }
    });
    
    let parent = null;
    if (parentRelationship) {
      parent = await prisma.user_parents.findUnique({
        where: {
          parent_id: parentRelationship.parent_id
        }
      });
    }
    
    // Fetch questionnaire responses
    const responses = await prisma.questionnaires_responds.findMany({
      where: {
        patient_id: parseInt(patientId)
      },
      include: {
        questionnaires: true
      }
    });
    
    // Process the data for PDF generation
    const reportData = {
      patient,
      parent,
      responses,
      generatedAt: new Date().toISOString()
    };
    
    return {
      statusCode: 200,
      message: 'PDF data prepared successfully',
      data: reportData
    };
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    
    return {
      statusCode: 500,
      message: 'Error generating PDF',
      error: error.message
    };
  }
}); 