export default defineEventHandler(async (event) => {
  try {
    // Get user from context
    const { userID, roles } = event.context.user || {};
    
    if (!userID) {
      return {
        statusCode: 401,
        message: "Unauthorized: Missing user session",
      };
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Check if user is admin or doctor
    const isAdmin = roles?.some(role => 
      role.includes('Admin') || role.includes('Administrator')
    );
    
    const isDoctor = roles?.some(role => 
      role.includes('Practitioners') || role.includes('Doctor')
    );

    // Get appointments based on user role
    let appointmentsQuery = {
      where: {
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
        deleted_at: null,
        status: {
          not: 37, // Exclude cancelled appointments
        },
      },
      select: {
        appointment_id: true,
        date: true,
        slot_ID: true,
        therapist_doctor_comment: true,
        user_patients: {
          select: {
            fullname: true,
          },
        },
        user_practitioners: {
          select: {
            user: {
              select: {
                userFullName: true,
              },
            },
            type: true,
          },
        },
        lookup: {
          select: {
            title: true,
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    };

    // If doctor, only show their appointments
    if (isDoctor && !isAdmin) {
      // Get the doctor's practitioner ID
      const doctor = await prisma.user_practitioners.findFirst({
        where: {
          user_id: parseInt(userID),
          type: 'Doctor',
          status: 'Active',
        },
      });

      if (doctor) {
        appointmentsQuery.where.practitioner_id = doctor.practitioner_id;
      }
    }

    const appointments = await prisma.appointments.findMany(appointmentsQuery);

    const formattedAppointments = appointments.map((a) => {
      // Check if this is an admin appointment (no practitioner assigned)
      const isAdminAppointment = !a.user_practitioners;
      
      return {
        patient: a.user_patients?.fullname || 'Unknown',
        userType: isAdminAppointment ? 'Admin' : (a.user_practitioners?.type || 'Unknown'),
        userName: isAdminAppointment ? 'Admin' : (a.user_practitioners?.user?.userFullName || 'Unknown'),
        date: a.date.toISOString().slice(0, 10),
        time: a.lookup?.title || '-',
        notes: a.therapist_doctor_comment || '',
      };
    });

    // Return different data based on user role
    if (isAdmin) {
      // Admin gets full statistics
      const totalUsers = await prisma.user.count({
        where: { userStatus: 'Active' },
      });

      const totalParents = await prisma.user_parents.count({
        where: { deleted_at: null },
      });

      const totalDoctors = await prisma.user_practitioners.count({
        where: {
          deleted_at: null,
          type: 'Doctor',
        },
      });

      const totalTherapists = await prisma.user_practitioners.count({
        where: {
          deleted_at: null,
          type: 'Therapist',
        },
      });

      return {
        userRole: 'admin',
        appointments: formattedAppointments,
        totalUsers,
        totalParents,
        totalDoctors,
        totalTherapists,
      };
    } else if (isDoctor) {
      // Doctor gets limited statistics
      const totalPatients = await prisma.user_patients.count({
        where: { deleted_at: null },
      });

      const totalAppointments = await prisma.appointments.count({
        where: {
          deleted_at: null,
          practitioner_id: {
            in: await prisma.user_practitioners.findMany({
              where: { user_id: parseInt(userID), type: 'Doctor' },
              select: { practitioner_id: true }
            }).then(docs => docs.map(d => d.practitioner_id))
          }
        }
      });

      const completedAppointments = await prisma.appointments.count({
        where: {
          deleted_at: null,
          status: 41, // Completed status
          practitioner_id: {
            in: await prisma.user_practitioners.findMany({
              where: { user_id: parseInt(userID), type: 'Doctor' },
              select: { practitioner_id: true }
            }).then(docs => docs.map(d => d.practitioner_id))
          }
        }
      });

      const pendingAppointments = await prisma.appointments.count({
        where: {
          deleted_at: null,
          status: 36, // Booked status
          practitioner_id: {
            in: await prisma.user_practitioners.findMany({
              where: { user_id: parseInt(userID), type: 'Doctor' },
              select: { practitioner_id: true }
            }).then(docs => docs.map(d => d.practitioner_id))
          }
        }
      });

      return {
        userRole: 'doctor',
        appointments: formattedAppointments,
        totalPatients,
        totalAppointments,
        completedAppointments,
        pendingAppointments,
      };
    } else {
      // Default response for unknown roles
      return {
        userRole: 'unknown',
        appointments: formattedAppointments,
        message: 'Limited access - contact administrator',
      };
    }
  } catch (error) {
    console.error('Dashboard API error:', error);
    return {
      statusCode: 500,
      message: 'Internal server error',
      error: error.message,
    };
  }
});
