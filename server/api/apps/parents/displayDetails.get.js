export default defineEventHandler(async (event) => {
    try {
      const query = getQuery(event);
      const parentID = query.parentID;
  
      const parents = await prisma.user_parents.findMany({
        where: {
          deleted_at: null,
          parent_id: parseInt(parentID)
        },
        orderBy: { created_at: 'desc' },
        include: {
          user: {
            select: {
              userUsername: true,
              userFullName: true,
              userEmail: true,
              userPhone: true,
              userIC: true,
            },
          },
          lookup_user_parents_parent_relationshipTolookup: {
            select: {
              lookupID: true,
              title: true, 
            },
          },
          lookup_user_parents_parent_nationalityTolookup: {
            select: {
              lookupID: true,
              title: true,
            },
          },
          lookup_user_parents_parent_stateTolookup: {
            select: {
              lookupID: true,
              title: true,
            },
          },
          // Include children through the user_parent_patient relationship
          user_parent_patient: {
            where: {
              user_patients: {
                deleted_at: null // Only include active children
              }
            },
            include: {
              user_patients: {
                select: {
                  patient_id: true,
                  fullname: true,
                  nickname: true,
                  patient_ic: true,
                  gender: true,
                  dob: true,
                  autism_diagnose: true,
                  diagnosed_on: true,
                  status: true,
                  available_session: true,
                  created_at: true,
                  update_at: true,
                }
              }
            }
          }
        },
      });
  
      const formattedParents = parents.map(parent => ({
        parentID: parent.parent_id,
        userID: parent.user_id,
        username: parent.user?.userUsername || '',
        fullName: parent.user?.userFullName || '',
        email: parent.user?.userEmail || '',
        phone: parent.user?.userPhone || '',
        ic: parent.user?.userIC || '',
        relationship: parent.lookup_user_parents_parent_relationshipTolookup?.title || '',
        nationality: parent.lookup_user_parents_parent_nationalityTolookup?.title || '',
        state: parent.lookup_user_parents_parent_stateTolookup?.title || '',
        status: parent.parent_status || '',
  
        // Added fields from fetchEdit API
        gender: parent.parent_gender || '',
        dateOfBirth: parent.parent_dob || '',
        addressLine1: parent.parent_add1 || '',
        addressLine2: parent.parent_add2 || '',
        addressLine3: parent.parent_add3 || '',
        city: parent.parent_city || '',
        postcode: parent.parent_postcode || '',
        
        // Include children data
        children: parent.user_parent_patient.map(childRelation => ({
          childID: childRelation.user_patients.patient_id,
          fullname: childRelation.user_patients.fullname || '',
          nickname: childRelation.user_patients.nickname || '',
          icNumber: childRelation.user_patients.patient_ic || '',
          gender: childRelation.user_patients.gender || '',
          dateOfBirth: childRelation.user_patients.dob || '',
          autismDiagnose: childRelation.user_patients.autism_diagnose || '',
          diagnosedDate: childRelation.user_patients.diagnosed_on || '',
          availableSession: childRelation.user_patients.available_session || 0,
          status: childRelation.user_patients.status || '',
          created_at: childRelation.user_patients.created_at || '',
          updated_at: childRelation.user_patients.update_at || '',
        }))
      }));
  
      //console.log(formattedParents);
  
      return {
        statusCode: 200,
        message: 'Success',
        data: formattedParents,
      };
  
    } catch (error) {
      console.error('GET /api/apps/parents/displayDetails error:', error);
      return {
        statusCode: 500,
        message: 'Internal Server Error',
        error: error.message
      };
    }
  });
  