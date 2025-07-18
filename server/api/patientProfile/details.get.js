import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  const patientId = parseInt(getQuery(event).patientId);

  if (!patientId) {
    return { statusCode: 400, message: 'Missing patientId' };
  }

  try {
    // 1. Patient details
    const patient = await prisma.user_patients.findUnique({
      where: { patient_id: patientId },
    });

    // 2. Find parentID via user_parent_patient
    const parentLink = await prisma.user_parent_patient.findFirst({
      where: { patient_id: patientId },
    });

    let parent = null;
    if (parentLink?.parent_id) {
      parent = await prisma.user_parents.findUnique({
        where: { parent_id: parentLink.parent_id },
        include: {
          user: {
            select: {
              userFullName: true,
              userEmail: true,
              userPhone: true,
              userIC: true,
            },
          },
          lookup_user_parents_parent_relationshipTolookup: { select: { title: true } },
          lookup_user_parents_parent_nationalityTolookup: { select: { title: true } },
          lookup_user_parents_parent_stateTolookup: { select: { title: true } },
        },
      });
    }

    // 3. Appointments (rich include and formatting)
    const appointmentsRaw = await prisma.appointments.findMany({
      where: { patient_id: patientId, deleted_at: null },
      orderBy: { date: 'desc' },
      include: {
        user_patients: true,
        user_practitioners: { include: { user: true } },
        service: true,
        lookup: true,
        user: true
      },
    });
    const appointments = appointmentsRaw.map((appt, idx) => ({
      id: appt.appointment_id,
      patient: appt.user_patients?.fullname || 'Unknown',
      practitioner: appt.user_practitioners?.user?.userFullName || 'Unknown',
      service: appt.service?.name || 'Unknown',
      time: appt.lookup?.title || '-',
      date: appt.date,
      status: appt.status,
      parent_comment: appt.parent_comment,
      therapist_doctor_comment: appt.therapist_doctor_comment,
      parent_rate: appt.parent_rate,
      sessionNumber: idx + 1,
    }));

    // 4. Questionnaires (rich include and formatting)
    const questionnairesRaw = await prisma.questionnaires_responds.findMany({
      where: { patient_id: patientId },
      orderBy: { created_at: 'desc' },
      include: {
        questionnaires: {
          include: {
            questionnaires_questions: true
          }
        },
        questionnaires_questions_answers: true,
      },
    });
    const questionnaires = questionnairesRaw.map(qr => ({
      qr_id: qr.qr_id,
      questionnaire_title: qr.questionnaires?.title || 'Assessment',
      created_at: qr.created_at,
      total_score: qr.total_score,
      questions: (qr.questionnaires?.questionnaires_questions || []).map(q => ({
        question_id: q.question_id,
        text_bm: q.question_text_bm,
        text_bi: q.question_text_bi,
        answer: qr.questionnaires_questions_answers.find(a => a.question_id === q.question_id) || null
      })),
      answers: qr.questionnaires_questions_answers,
    }));

    // 5. Referrals (mock or real)
    let referrals = [];
    try {
      const refRes = await $fetch(`/api/patientProfile/referrals?patientId=${patientId}`);
      if (refRes && refRes.length) referrals = refRes;
    } catch (e) {
      // fallback to empty or mock
    }

    return {
      statusCode: 200,
      message: 'Success',
      data: {
        patient,
        parent: parent && {
          ...parent,
          fullName: parent.user?.userFullName || '',
          email: parent.user?.userEmail || '',
          phone: parent.user?.userPhone || '',
          ic: parent.user?.userIC || '',
          relationship: parent.lookup_user_parents_parent_relationshipTolookup?.title || '',
          nationality: parent.lookup_user_parents_parent_nationalityTolookup?.title || '',
          state: parent.lookup_user_parents_parent_stateTolookup?.title || '',
          gender: parent.parent_gender || '',
          dateOfBirth: parent.parent_dob || '',
          addressLine1: parent.parent_add1 || '',
          addressLine2: parent.parent_add2 || '',
          addressLine3: parent.parent_add3 || '',
          city: parent.parent_city || '',
          postcode: parent.parent_postcode || '',
          status: parent.parent_status || '',
        },
        appointments,
        questionnaires,
        referrals,
      }
    };
  } catch (err) {
    console.error('Error in /api/patientProfile/details:', err);
    return { statusCode: 500, message: 'Internal Server Error' };
  }
}); 