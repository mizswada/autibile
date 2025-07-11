import { PrismaClient } from '@prisma/client';

export default defineEventHandler(async (event) => {
  try {
    const prisma = new PrismaClient();
    
    // Get all active patients
    const patients = await prisma.user_patients.findMany({
      where: {
        status: 'ACTIVE',
        deleted_at: null
      },
      select: {
        patient_id: true,
        fullname: true,
        nickname: true
      },
      orderBy: {
        fullname: 'asc'
      }
    });

    //console.log(patients);
    
    // Get all active practitioners
    const practitioners = await prisma.user_practitioners.findMany({
      where: {
        status: 'ACTIVE',
        deleted_at: null
      },
      include: {
        user: {
          select: {
            userFullName: true
          }
        }
      },
      orderBy: {
        user: {
          userFullName: 'asc'
        }
      }
    });

    //console.log(practitioners);
    
    // Format practitioners for dropdown
    const formattedPractitioners = practitioners.map(practitioner => {
      return {
        value: practitioner.practitioner_id,
        label: practitioner.user?.userFullName || `Practitioner ${practitioner.practitioner_id}`,
        type: practitioner.type,
        specialty: practitioner.specialty
      };
    });
    
    // Get all active services
    const services = await prisma.service.findMany({
      where: {
        deleted_at: null
      },
      select: {
        service_id: true,
        name: true,
        description: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    //console.log(services);
    
    // Format patients for dropdown
    const formattedPatients = patients.map(patient => {
      return {
        value: patient.patient_id,
        label: patient.fullname,
        nickname: patient.nickname
      };
    });
    
    // Format services for dropdown
    const formattedServices = services.map(service => {
      return {
        value: service.service_id,
        label: service.name,
        description: service.description
      };
    });
    
    return {
      success: true,
      data: {
        patients: formattedPatients,
        practitioners: formattedPractitioners,
        services: formattedServices
      }
    };
  } catch (error) {
    console.error('Error fetching appointment options:', error);
    return {
      success: false,
      message: 'Failed to fetch appointment options',
      error: error.message
    };
  }
}); 