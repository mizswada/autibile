export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const childID = parseInt(body.childID);
  const parentID = body.parentID ? parseInt(body.parentID) : null;
  const status = body.status;

  if (!childID || !status) {
    return { statusCode: 400, message: "Missing child ID or status" };
  }

  if (!["Active", "Inactive"].includes(status)) {
    return {
      statusCode: 400,
      message: 'Invalid status value. Must be either "Active" or "Inactive"',
    };
  }

  try {
    const child = await prisma.user_patients.findFirst({
      where: {
        patient_id: childID,
        deleted_at: null,
      },
      select: {
        patient_id: true,
        user_id: true,
      },
    });

    if (!child) {
      return { statusCode: 404, message: "Child not found" };
    }

    // Resolve parent link(s) for this child
    const parentLinks = await prisma.user_parent_patient.findMany({
      where: {
        patient_id: childID,
        ...(parentID ? { parent_id: parentID } : {}),
      },
      include: {
        user_parents: {
          select: {
            parent_id: true,
            parent_status: true,
            deleted_at: true,
          },
        },
      },
    });

    if (!parentLinks.length) {
      return {
        statusCode: 400,
        message: "Child is not linked to a parent",
      };
    }

    const hasInactiveParent = parentLinks.some(
      (link) =>
        link.user_parents &&
        (link.user_parents.deleted_at ||
          String(link.user_parents.parent_status || "").toLowerCase() !==
            "active"),
    );

    if (hasInactiveParent) {
      return {
        statusCode: 400,
        message:
          "Cannot change child status while the parent account is inactive",
      };
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.user_patients.update({
        where: { patient_id: childID },
        data: {
          status,
          update_at: now,
        },
      });

      if (child.user_id) {
        await tx.user.update({
          where: { userID: child.user_id },
          data: {
            userStatus: status,
            userModifiedDate: now,
          },
        });
      }
    });

    return { statusCode: 200, message: "Status updated" };
  } catch (err) {
    console.error("Status update failed:", err);
    return { statusCode: 500, message: "Internal server error" };
  }
});
