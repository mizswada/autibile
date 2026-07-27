export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const parentID = parseInt(body.parentID);
  const status = body.status;

  if (!parentID || !status) {
    return { statusCode: 400, message: "Missing parent ID or status" };
  }

  if (!["Active", "Inactive"].includes(status)) {
    return {
      statusCode: 400,
      message: 'Invalid status value. Must be either "Active" or "Inactive"',
    };
  }

  try {
    const parent = await prisma.user_parents.findUnique({
      where: { parent_id: parentID },
      select: { user_id: true, deleted_at: true },
    });

    if (!parent || parent.deleted_at) {
      return { statusCode: 404, message: "Parent not found" };
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.user_parents.update({
        where: { parent_id: parentID },
        data: { parent_status: status },
      });

      if (parent.user_id) {
        await tx.user.update({
          where: { userID: parent.user_id },
          data: {
            userStatus: status,
            userModifiedDate: now,
          },
        });
      }

      // When parent becomes Inactive, cascade to all linked children
      if (status === "Inactive") {
        const links = await tx.user_parent_patient.findMany({
          where: { parent_id: parentID },
          select: {
            patient_id: true,
            user_patients: {
              select: { user_id: true, deleted_at: true },
            },
          },
        });

        const childIDs = links
          .filter((link) => link.user_patients && !link.user_patients.deleted_at)
          .map((link) => link.patient_id);

        if (childIDs.length > 0) {
          await tx.user_patients.updateMany({
            where: {
              patient_id: { in: childIDs },
              deleted_at: null,
            },
            data: {
              status: "Inactive",
              update_at: now,
            },
          });

          const childUserIDs = links
            .map((link) => link.user_patients?.user_id)
            .filter((userId) => userId != null);

          if (childUserIDs.length > 0) {
            await tx.user.updateMany({
              where: { userID: { in: childUserIDs } },
              data: {
                userStatus: "Inactive",
                userModifiedDate: now,
              },
            });
          }
        }
      }
    });

    return {
      statusCode: 200,
      message:
        status === "Inactive"
          ? "Parent and linked children set to Inactive"
          : "Status updated",
    };
  } catch (err) {
    console.error("Status update failed:", err);
    return { statusCode: 500, message: "Internal server error" };
  }
});
