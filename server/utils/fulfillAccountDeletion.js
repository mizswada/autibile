/**
 * Soft-delete / deactivate a user account when an account deletion request is approved.
 */
export async function fulfillAccountDeletion({ userId, accountType }) {
  const currentDate = new Date();

  const user = await prisma.user.findFirst({
    where: { userID: userId },
    select: {
      userID: true,
      userEmail: true,
      user_parents: {
        where: { deleted_at: null },
        select: { parent_id: true },
      },
      user_practitioners: {
        where: { deleted_at: null },
        select: { practitioner_id: true, type: true },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (accountType === "Parents") {
    const parent = user.user_parents?.[0];
    if (!parent) {
      await prisma.user.update({
        where: { userID: userId },
        data: {
          userStatus: "Inactive",
          userModifiedDate: currentDate,
        },
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const links = await tx.user_parent_patient.findMany({
        where: { parent_id: parent.parent_id },
        select: { patient_id: true },
      });

      const childIDs = links.map((link) => link.patient_id);

      if (childIDs.length > 0) {
        const children = await tx.user_patients.findMany({
          where: {
            patient_id: { in: childIDs },
            deleted_at: null,
          },
          select: { user_id: true },
        });

        await tx.user_patients.updateMany({
          where: {
            patient_id: { in: childIDs },
            deleted_at: null,
          },
          data: {
            deleted_at: currentDate,
            status: "Inactive",
          },
        });

        const childUserIDs = children
          .map((child) => child.user_id)
          .filter((id) => id != null);

        if (childUserIDs.length > 0) {
          await tx.user.updateMany({
            where: { userID: { in: childUserIDs } },
            data: {
              userStatus: "Inactive",
              userModifiedDate: currentDate,
            },
          });
        }
      }

      await tx.user_parents.update({
        where: { parent_id: parent.parent_id },
        data: {
          deleted_at: currentDate,
          parent_status: "Inactive",
        },
      });

      await tx.user.update({
        where: { userID: userId },
        data: {
          userStatus: "Inactive",
          userModifiedDate: currentDate,
        },
      });
    });
    return;
  }

  const practitioner = (user.user_practitioners || []).find((item) => {
    if (accountType === "Doctor") return item.type === "Doctor";
    if (accountType === "Therapist") return item.type === "Therapist";
    return false;
  });

  if (!practitioner) {
    await prisma.user.update({
      where: { userID: userId },
      data: {
        userStatus: "Inactive",
        userModifiedDate: currentDate,
      },
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user_practitioners.update({
      where: { practitioner_id: practitioner.practitioner_id },
      data: {
        deleted_at: currentDate,
        status: "Inactive",
      },
    });

    await tx.user.update({
      where: { userID: userId },
      data: {
        userStatus: "Inactive",
        userModifiedDate: currentDate,
      },
    });
  });
}
