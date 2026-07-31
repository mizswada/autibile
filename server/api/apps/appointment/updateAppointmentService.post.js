import prisma from "~/server/utils/prisma";
import {
  attachAppointmentTimes,
  getAppointmentTimes,
  toDateOnlyString,
} from "~/server/utils/appointmentTime";

const CANCELLED_STATUS = 37;
const COMPLETED_STATUS = 41;

function getAppointmentStartDate(appointment) {
  const { start_time } = getAppointmentTimes(appointment);
  const dateStr = toDateOnlyString(appointment.date);
  return new Date(`${dateStr}T${start_time}:00`);
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { appointment_id, service_id, practitioner_id } = body;

    if (!appointment_id) {
      return {
        success: false,
        message: "Missing required field: appointment_id",
      };
    }

    if (!service_id) {
      return {
        success: false,
        message: "Missing required field: service_id",
      };
    }

    const parsedServiceId = parseInt(service_id, 10);
    if (Number.isNaN(parsedServiceId)) {
      return {
        success: false,
        message: "Invalid service_id",
      };
    }

    const existingAppointment = await prisma.appointments.findUnique({
      where: {
        appointment_id: parseInt(appointment_id, 10),
      },
      include: {
        service: {
          select: {
            service_id: true,
            name: true,
          },
        },
      },
    });

    if (!existingAppointment || existingAppointment.deleted_at) {
      return {
        success: false,
        message: "Appointment not found",
      };
    }

    if (
      practitioner_id &&
      existingAppointment.practitioner_id !== parseInt(practitioner_id, 10)
    ) {
      return {
        success: false,
        message: "You are not assigned to this appointment",
      };
    }

    if (existingAppointment.status === CANCELLED_STATUS) {
      return {
        success: false,
        message: "Cannot change service for a cancelled appointment",
      };
    }

    if (existingAppointment.status === COMPLETED_STATUS) {
      return {
        success: false,
        message: "Cannot change service for a completed appointment",
      };
    }

    await attachAppointmentTimes(prisma, existingAppointment);

    const appointmentStart = getAppointmentStartDate(existingAppointment);
    if (appointmentStart <= new Date()) {
      return {
        success: false,
        message: "Service can only be changed for future appointments",
      };
    }

    if (existingAppointment.service_id === parsedServiceId) {
      return {
        success: true,
        message: "Service is already set to this value",
        data: {
          appointment_id: existingAppointment.appointment_id,
          service_id: existingAppointment.service_id,
          service_name: existingAppointment.service?.name || "",
        },
      };
    }

    const service = await prisma.service.findFirst({
      where: {
        service_id: parsedServiceId,
        deleted_at: null,
      },
      select: {
        service_id: true,
        name: true,
      },
    });

    if (!service) {
      return {
        success: false,
        message: "Service not found",
      };
    }

    const updatedAppointment = await prisma.appointments.update({
      where: {
        appointment_id: parseInt(appointment_id, 10),
      },
      data: {
        service_id: parsedServiceId,
        updated_at: new Date(),
      },
      include: {
        service: {
          select: {
            service_id: true,
            name: true,
          },
        },
      },
    });

    return {
      success: true,
      message: "Appointment service updated successfully",
      data: {
        appointment_id: updatedAppointment.appointment_id,
        service_id: updatedAppointment.service?.service_id,
        service_name: updatedAppointment.service?.name || "",
        updated_at: updatedAppointment.updated_at,
      },
    };
  } catch (error) {
    console.error("Error updating appointment service:", error);
    return {
      success: false,
      message: error.message || "Failed to update appointment service",
      error: error.message,
    };
  }
});
