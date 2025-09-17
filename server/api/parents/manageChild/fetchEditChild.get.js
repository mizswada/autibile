// Added by: Firzana Huda 24 June 2025
import { PrismaClient } from '@prisma/client';

export default defineEventHandler(async (event) => {
    const { childID } = getQuery(event);
  
    if (!childID) {
      return { statusCode: 400, message: 'Missing child ID' };
    }
  
    try {
      const prisma = new PrismaClient();
      const child = await prisma.user_patients.findUnique({
        where: { patient_id: parseInt(childID) },
        select: {
          patient_id: true,
          fullname: true,
          nickname: true,
          gender: true,
          patient_ic: true,
          dob: true,
          autism_diagnose: true,
          diagnosed_on: true,
          available_session: true,
          status: true,
          OKUCard: true,
          treatment_type: true,
        }
      });
  
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

      // Function to map OKU card numbers to strings
      const mapOKUCard = (okuCard) => {
        if (okuCard === null || okuCard === undefined) return '';
        
        const cardMap = {
          1: 'Yes',
          0: 'No',
          '1': 'Yes',
          '0': 'No',
          'Yes': 'Yes',
          'No': 'No'
        };
        
        return cardMap[okuCard] || '';
      };

      // Map treatment type and OKU card if they exist
      const mappedChild = child ? {
        ...child,
        treatment_type: mapTreatmentType(child.treatment_type),
        OKUCard: mapOKUCard(child.OKUCard)
      } : null;

      return {
        statusCode: 200,
        data: mappedChild,
      };
    } catch (error) {
      console.error('Error fetching child detail:', error);
      return {
        statusCode: 500,
        message: 'Internal server error',
      };
    }
  });
  