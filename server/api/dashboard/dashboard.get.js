export default defineEventHandler(async (event) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const appointments = await prisma.appointments.findMany({
    where: {
      date: {
        gte: todayStart,
        lte: todayEnd,
      },
      deleted_at: null,
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
  });

  const formattedAppointments = appointments.map((a) => ({
    patient: a.user_patients?.fullname || 'Unknown',
    userType: a.user_practitioners?.type || 'Unknown',
    userName: a.user_practitioners?.user?.userFullName || 'Unknown',
    date: a.date.toISOString().slice(0, 10),
    time: a.lookup?.title || '-',
    notes: a.therapist_doctor_comment || '',
  }));

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
    appointments: formattedAppointments,
    totalUsers,
    totalParents,
    totalDoctors,
    totalTherapists,
  };
});
