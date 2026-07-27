// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
    const body = await readBody(event);
  
    const {
      childID,
      fullname,
      nickname,
      gender,
      icNumber,
      dateOfBirth,
      autismDiagnose,
      diagnosedDate,
      availableSession,
      status,
      okuCard,
      treatmentType,
    } = body;
  
    if (!childID) {
      return { statusCode: 400, message: 'Missing child ID' };
    }
  
    try {
      const existingChild = await prisma.user_patients.findFirst({
        where: {
          patient_id: parseInt(childID),
          deleted_at: null,
        },
        select: { status: true },
      });

      if (!existingChild) {
        return { statusCode: 404, message: 'Child not found' };
      }

      if (
        status &&
        status !== existingChild.status
      ) {
        const parentLinks = await prisma.user_parent_patient.findMany({
          where: { patient_id: parseInt(childID) },
          include: {
            user_parents: {
              select: {
                parent_status: true,
                deleted_at: true,
              },
            },
          },
        });

        const hasInactiveParent = parentLinks.some(
          (link) =>
            link.user_parents &&
            (link.user_parents.deleted_at ||
              String(link.user_parents.parent_status || '').toLowerCase() !==
                'active'),
        );

        if (hasInactiveParent) {
          return {
            statusCode: 400,
            message:
              'Cannot change child status while the parent account is inactive',
          };
        }
      }

      // Function to convert OKU card string to number
      const convertOKUCard = (okuCard) => {
        if (okuCard === 'Yes') return 1;
        if (okuCard === 'No') return 0;
        if (okuCard === 1 || okuCard === '1') return 1;
        if (okuCard === 0 || okuCard === '0') return 0;
        return null;
      };

      // Function to convert treatment type string to number
      const convertTreatmentType = (treatmentType) => {
        if (treatmentType === 'Centre') return '1';
        if (treatmentType === 'Online') return '2';
        if (treatmentType === 'In House') return '3';
        return treatmentType; // Return as-is if already a number or unknown
      };

      await prisma.user_patients.update({
        where: { patient_id: parseInt(childID) },
        data: {
          fullname,
          nickname,
          gender,
          patient_ic: icNumber,
          dob: new Date(dateOfBirth),
          autism_diagnose: autismDiagnose,
          diagnosed_on: new Date(diagnosedDate),
          available_session: parseInt(availableSession),
          status,
          OKUCard: convertOKUCard(okuCard),
          treatment_type: convertTreatmentType(treatmentType),
          update_at: new Date(),
        },
      });
  
      return {
        statusCode: 200,
        message: 'Child updated successfully',
      };
    } catch (err) {
      console.error('Update error:', err);
      return {
        statusCode: 500,
        message: 'Internal server error',
      };
    }
  });
  