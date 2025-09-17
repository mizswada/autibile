export default defineEventHandler(async (event) => {
    try {  
      const body = await readBody(event);

      const { 
        practitionerID,
        registrationNo,
        specialty,
        qualification,
        experience,
        signature,
      } = body;
  
      if (!practitionerID) {
        return {
          statusCode: 400,
          message: "Missing practitionerID",
        };
      }
        
        // Check if practitioner record exists for this user
        const existing = await prisma.user_practitioners.findFirst({
        where: { practitioner_id: Number(practitionerID) },
        });

        // Ensure signature is in correct format
        let formattedSignature = signature;
        if (signature && !signature.startsWith('data:image/png;base64,')) {
          formattedSignature = 'data:image/png;base64,' + signature;
        }

        if (existing) {
        // Update existing practitioner
        await prisma.user_practitioners.update({
            where: { practitioner_id: existing.practitioner_id },
            data: {
            registration_no: registrationNo || null,
            specialty: specialty || null,
            qualifications: qualification || null,
            experience_years: parseInt(experience) || null,
            signature: formattedSignature || null,
            updated_at: new Date(),
            },
        });
        }

        return {
        statusCode: 200,
        message: "Practitioner details saved successfully",
        };
    } catch (error) {
        console.error('API /apps/practitioners/details error:', error);
        return {
        statusCode: 500,
        message: "Failed to save practitioner details",
        };
    }
    });