import {
  ACTIVE_STATUS,
  activeParentWhere,
} from "~/server/utils/activeEntities";
import {
  calculateAgeInMonths,
  evaluateAgeAgainstLimits,
  formatAgeRange,
} from "~/server/utils/questionnaireAge";

const MCHATR_QUESTIONNAIRE_ID = 1;

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const parentID = query.parentID ? parseInt(query.parentID) : null;
    const activeOnly =
      query.activeOnly === "true" ||
      query.activeOnly === "1" ||
      query.activeOnly === true;
    const hasDiary =
      query.hasDiary === "true" ||
      query.hasDiary === "1" ||
      query.hasDiary === true;

    const parentFilter = activeOnly
      ? activeParentWhere()
      : { deleted_at: null };

    const childFilter = {
      deleted_at: null,
      ...(activeOnly ? { status: ACTIVE_STATUS } : {}),
      ...(hasDiary ? { diary_report: { some: {} } } : {}),
    };

    let relations;

    if (parentID) {
      // Get children for specific parent
      relations = await prisma.user_parent_patient.findMany({
        where: { 
          parent_id: parentID,
          user_parents: parentFilter,
          user_patients: childFilter,
        },
        include: {
          user_patients: true,
          user_parents: {
            include: {
              user: true // include user to get username
            }
          }
        }
      });
    } else {
      // Get all children with their parent
      relations = await prisma.user_parent_patient.findMany({
        where: {
          user_parents: parentFilter,
          user_patients: childFilter,
        },
        include: {
          user_patients: true,
          user_parents: {
            include: {
              user: true
            }
          }
        }
      });
    }

    // Function to map treatment type numbers to strings
    const mapTreatmentType = (treatmentType) => {
      if (!treatmentType) return '';
      
      const typeMap = {
        '1': 'Centre',
        '2': 'Online', 
        '3': 'In House',
        'Centre': 'Centre',
        'Online': 'Online',
        'In House': 'In House'
      };
      
      return typeMap[treatmentType] || treatmentType;
    };

    // M-CHAT-R age range, used to warn the admin when unlocking an
    // out-of-range child.
    const mchatrConfig = await prisma.questionnaires.findUnique({
      where: { questionnaire_id: MCHATR_QUESTIONNAIRE_ID },
      select: { min_age_months: true, max_age_months: true },
    });
    const mchatrRangeLabel = formatAgeRange(
      mchatrConfig?.min_age_months,
      mchatrConfig?.max_age_months,
    );

    // Optional billing summary (unpaid invoices per child) for list screens that show a payment badge.
    const includeBilling =
      query.includeBilling === "true" ||
      query.includeBilling === "1" ||
      query.includeBilling === true;
    const billingByPatient = new Map();
    if (includeBilling && relations.length) {
      const patientIds = [...new Set(relations.map((r) => r.user_patients.patient_id))];
      const unpaidWhere = { deleted_at: null, status: "Unpaid", patient_id: { in: patientIds } };
      const [unpaidRows, payLaterRows] = await Promise.all([
        prisma.invoice.groupBy({
          by: ["patient_id"],
          where: unpaidWhere,
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.invoice.groupBy({
          by: ["patient_id"],
          where: { ...unpaidWhere, pay_later: true },
          _sum: { amount: true },
          _count: { _all: true },
        }),
      ]);
      for (const row of unpaidRows) {
        billingByPatient.set(row.patient_id, {
          unpaidAmount: Number(row._sum.amount || 0),
          unpaidCount: row._count._all,
          payLaterAmount: 0,
          payLaterCount: 0,
        });
      }
      for (const row of payLaterRows) {
        const entry = billingByPatient.get(row.patient_id);
        if (entry) {
          entry.payLaterAmount = Number(row._sum.amount || 0);
          entry.payLaterCount = row._count._all;
        }
      }
    }

    const transformed = relations.map(r => {
      const c = r.user_patients;
      const p = r.user_parents;
      const mchatrAgeEval = evaluateAgeAgainstLimits(
        calculateAgeInMonths(c.dob),
        mchatrConfig?.min_age_months,
        mchatrConfig?.max_age_months,
      );
      return {
        childID: c.patient_id,
        parentID: r.parent_id,
        parentFullName: p.user?.userFullName || '', // <-- add parent full name here
        parentStatus: p.parent_status || '',
        parentCity: p.parent_city || '',
        fullname: c.fullname || '',
        nickname: c.nickname,
        icNumber: c.patient_ic,
        gender: c.gender,
        dateOfBirth: c.dob,
        autismDiagnose: c.autism_diagnose,
        diagnosedDate: c.diagnosed_on,
        availableSession: c.available_session,
        status: c.status,
        mchatr_status: c.mchatr_status,
        mchatrAgeInRange: mchatrAgeEval.inRange,
        mchatrAgeRangeLabel: mchatrRangeLabel,
        okuCard: c.OKUCard,
        treatmentType: mapTreatmentType(c.treatment_type),
        registeredAt: c.created_at || c.update_at || null,
        ...(includeBilling
          ? {
              unpaidAmount: 0,
              unpaidCount: 0,
              payLaterAmount: 0,
              payLaterCount: 0,
              ...(billingByPatient.get(c.patient_id) || {}),
            }
          : {}),
      };
    });

    return {
      statusCode: 200,
      message: 'Success',
      data: transformed,
    };
  } catch (error) {
    console.error('GET /listChild error:', error);
    return {
      statusCode: 500,
      message: 'Internal Server Error',
      error: error.message
    };
  }
});
