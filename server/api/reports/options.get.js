import prisma from "~/server/utils/prisma";
import { requireAdmin } from "~/server/utils/reports/guard";

/**
 * Filter dropdown data for the report builder (patients, practitioners,
 * services, therapy centres).
 */
export default defineEventHandler(async (event) => {
  const guard = requireAdmin(event);
  if (!guard.ok) {
    setResponseStatus(event, guard.statusCode);
    return { success: false, message: guard.message };
  }

  try {
    const [patients, practitioners, services, centers, parents, questionnaires] =
      await Promise.all([
      prisma.user_patients.findMany({
        where: { deleted_at: null },
        select: { patient_id: true, fullname: true, patient_ic: true },
        orderBy: { fullname: "asc" },
      }),
      prisma.user_practitioners.findMany({
        where: { deleted_at: null },
        include: { user: { select: { userFullName: true } } },
        orderBy: { practitioner_id: "asc" },
      }),
      prisma.service.findMany({
        where: { deleted_at: null },
        select: { service_id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.therapyst_center.findMany({
        where: { deleted_at: null },
        select: { center_ID: true, center_name: true },
        orderBy: { center_name: "asc" },
      }),
      prisma.user_parents.findMany({
        where: { deleted_at: null },
        include: { user: { select: { userFullName: true } } },
        orderBy: { parent_id: "asc" },
      }),
      prisma.questionnaires.findMany({
        where: { deleted_at: null },
        select: { questionnaire_id: true, title: true },
        orderBy: { title: "asc" },
      }),
    ]);

    return {
      success: true,
      data: {
        patients: patients.map((p) => ({
          value: p.patient_id,
          label: p.patient_ic ? `${p.fullname} (${p.patient_ic})` : p.fullname,
        })),
        practitioners: practitioners.map((p) => ({
          value: p.practitioner_id,
          label: p.user?.userFullName || `Practitioner ${p.practitioner_id}`,
        })),
        services: services.map((s) => ({ value: s.service_id, label: s.name })),
        centers: centers.map((c) => ({
          value: c.center_ID,
          label: c.center_name,
        })),
        parents: parents.map((p) => ({
          value: p.parent_id,
          label: p.user?.userFullName || `Parent ${p.parent_id}`,
        })),
        questionnaires: questionnaires.map((q) => ({
          value: q.questionnaire_id,
          label: q.title || `Questionnaire ${q.questionnaire_id}`,
        })),
      },
    };
  } catch (error) {
    console.error("GET /api/reports/options error:", error);
    setResponseStatus(event, 500);
    return { success: false, message: "Failed to load report options" };
  }
});
