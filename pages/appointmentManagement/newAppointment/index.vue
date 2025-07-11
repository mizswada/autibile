<script setup>
import { ref, onMounted, watch } from 'vue';
import { useUserStore } from '@/stores/user';
import { useLazyFetch } from '#app';

const userStore = useUserStore();
const currentUserId = userStore.userID || 1; // fallback to 1 if not set

// Loading states
const isLoading = ref(false);
const isLoadingSlots = ref(false); // Separate loading state for time slots
const errorMessage = ref("");
const successMessage = ref("");

// Appointments data
const appointments = ref([]);
const rawData = ref([]);

// Modal state
const showModal = ref(false);
const showDetailsModal = ref(false);
const showEditModal = ref(false);
const showCommentModal = ref(false);
const showRatingModal = ref(false);
const isEditing = ref(false);

// Form data
const appointmentForm = ref({
  date: new Date().toISOString().slice(0, 10),
  time: "",
  patient: "",
  serviceId: "",
  therapistDoctor: "",
  status: 36 // Added status field
});

// Rating form
const ratingForm = ref({
  rating: 0
});

// Options
const patientOptions = ref([{ label: "--- Please select ---", value: "" }]);
const serviceOptions = ref([
  { label: "--- Please select ---", value: "" },
  { label: "Consultation", value: "1" },
  { label: "Therapy", value: "2" }
]);
const therapistDoctorOptions = ref([{ label: "--- Please select ---", value: "" }]);
const timeSlotOptions = ref([{ label: "--- Please select ---", value: "" }]);

// Table columns
const columns = [
  { name: 'patientName', label: 'Patient Name' },
  { name: 'practitionerName', label: 'Practitioner' },
  { name: 'serviceName', label: 'Service' },
  { name: 'date', label: 'Date' },
  { name: 'timeSlot', label: 'Time Slot' },
  { name: 'status', label: 'Status' },
  { name: 'action', label: 'Actions' }
];

// Status mapping
const statusMapping = {
  36: { label: 'Booked', class: 'bg-yellow-100 text-yellow-800' },
  37: { label: 'Cancelled', class: 'bg-red-100 text-red-800' },
  38: { label: 'Start', class: 'bg-blue-100 text-blue-800' },
  39: { label: 'Confirm Start', class: 'bg-green-100 text-green-800' },
  40: { label: 'Finish', class: 'bg-purple-100 text-purple-800' },
  41: { label: 'Completed', class: 'bg-indigo-100 text-indigo-800' },
};

// Selected appointment for viewing/editing
const selectedAppointment = ref(null);

// Comment form
const commentForm = ref({
  comment: "",
  userType: "" // "parent" or "practitioner"
});

// Status options for dropdown
const statusOptions = ref([
  { label: "Booked", value: "36" },
  { label: "Cancelled", value: "37" },
  { label: "Started", value: "38" },
  { label: "Confirmed Start", value: "39" },
  { label: "Finished", value: "40" },
  { label: "Completed", value: "41" }
]);

// Fetch appointments
const { data: appointmentsData, pending: appointmentsLoading, refresh: refreshAppointments } = useLazyFetch('/api/appointments/list', {
  immediate: true,
  server: false,
  key: 'appointments-list',
  transform: (response) => {
    if (response && response.success) {
      // Store raw data
      const rawAppointments = response.data.map(appt => {
        console.log("API appointment data:", appt.extendedProps);
        return {
          id: appt.id,
          patientName: appt.extendedProps.patient_name || 'Unknown Patient',
          practitionerName: appt.extendedProps.practitioner_name || 'Unknown Practitioner',
          serviceName: appt.extendedProps.service_name || 'Unknown Service',
          date: new Date(appt.start).toLocaleDateString(),
          timeSlot: appt.extendedProps.time_slot || 'Unknown Time',
          status: appt.extendedProps.status || 36,
          patientId: appt.extendedProps.patient_id,
          practitionerId: appt.extendedProps.practitioner_id,
          serviceId: appt.extendedProps.service_id,
          slotId: appt.extendedProps.slot_ID,
          parentComment: appt.extendedProps.parent_comment,
          therapistDoctorComment: appt.extendedProps.therapist_doctor_comment,
          parentRate: appt.extendedProps.parent_rate || 0,
          rawExtendedProps: appt.extendedProps
        };
      });
      
      rawData.value = rawAppointments;
      
      // Create the table data from raw data
      return rawAppointments.map(appt => ({
        id: appt.id,
        patientName: appt.patientName,
        practitionerName: appt.practitionerName,
        serviceName: appt.serviceName,
        date: appt.date,
        timeSlot: appt.timeSlot,
        status: appt.status,
        action: 'edit'
      }));
    }
    return [];
  }
});

// Set appointments from the fetched data
watch(appointmentsData, (newData) => {
  if (newData) {
    appointments.value = newData;
  }
});

// Fetch options from API
const { data: optionsData, pending: optionsLoading } = useLazyFetch('/api/appointments/options', {
  immediate: true,
  server: false,
  key: 'appointments-options',
  transform: (response) => {
    if (response && response.success) {
      return {
        patients: response.data.patients,
        practitioners: response.data.practitioners
      };
    }
    return { patients: [], practitioners: [] };
  }
});

// Set options from the fetched data
watch(optionsData, (newData) => {
  if (newData) {
    patientOptions.value = [
      { label: "--- Please select ---", value: "" },
      ...newData.patients
    ];
    therapistDoctorOptions.value = [
      { label: "--- Please select ---", value: "" },
      ...newData.practitioners
    ];
  }
});

// Fetch available time slots based on date + practitioner
const fetchTimeSlots = async () => {
  try {
    if (!appointmentForm.value.date || !appointmentForm.value.therapistDoctor) {
      timeSlotOptions.value = [{ label: "--- Please select ---", value: "" }];
      return;
    }

    isLoadingSlots.value = true;
    errorMessage.value = "";
    
    const { data } = await useLazyFetch('/api/appointments/slots', {
      query: {
        date: appointmentForm.value.date,
        practitioner_id: appointmentForm.value.therapistDoctor
      },
      server: false
    });

    if (data.value && data.value.success) {
      timeSlotOptions.value = [
        { label: "--- Please select ---", value: "" },
        ...data.value.data
          .filter(slot => slot.isAvailable)
          .map(slot => ({
            label: slot.title || slot.value,
            value: slot.lookupID
          }))
      ];
      
      // If no available slots, show a message
      if (timeSlotOptions.value.length === 1) {
        errorMessage.value = "No available time slots for the selected date and practitioner";
      }
    } else {
      errorMessage.value = data.value?.message || "Failed to load time slots";
      timeSlotOptions.value = [{ label: "--- Please select ---", value: "" }];
    }
  } catch (error) {
    console.error("Error fetching time slots:", error);
    errorMessage.value = "Error loading time slots. Please try again.";
    timeSlotOptions.value = [{ label: "--- Please select ---", value: "" }];
  } finally {
    isLoadingSlots.value = false;
  }
};

// Watch date or therapist to fetch slots
let timeoutId = null;
watch(
  () => [appointmentForm.value.date, appointmentForm.value.therapistDoctor],
  () => {
    if (appointmentForm.value.date && appointmentForm.value.therapistDoctor) {
      // Clear any existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Set a new timeout to debounce the fetchTimeSlots call
      timeoutId = setTimeout(() => {
        fetchTimeSlots();
      }, 300);
    }
  }
);

// Save appointment to API
const saveAppointment = async () => {
  try {
    // Validate
    if (!appointmentForm.value.date || 
        !appointmentForm.value.time || 
        !appointmentForm.value.patient || 
        !appointmentForm.value.therapistDoctor || 
        !appointmentForm.value.serviceId) {
      errorMessage.value = "Please fill in all required fields";
      return;
    }

    isLoading.value = true;
    errorMessage.value = "";
    successMessage.value = "";

    // Prepare data
    const appointmentData = {
      patient_id: appointmentForm.value.patient,
      practitioner_id: appointmentForm.value.therapistDoctor,
      book_by: currentUserId,
      service_id: appointmentForm.value.serviceId,
      date: appointmentForm.value.date,
      slot_ID: appointmentForm.value.time,
      status: 36 // Booked status
    };

    const { data } = await useFetch('/api/appointments/create', {
      method: 'POST',
      body: appointmentData
    });

    if (data.value && data.value.success) {
      successMessage.value = "Appointment created successfully!";
      // Reset form
      appointmentForm.value = {
        date: new Date().toISOString().slice(0, 10),
        time: "",
        patient: "",
        serviceId: "",
        therapistDoctor: "",
        status: 36
      };
      timeSlotOptions.value = [{ label: "--- Please select ---", value: "" }];
      
      // Close modal and refresh appointments
      showModal.value = false;
      await refreshAppointments();
    } else {
      errorMessage.value = data.value?.message || "Failed to create appointment";
    }
  } catch (error) {
    console.error("Error saving appointment:", error);
    errorMessage.value = "Error creating appointment. Please try again.";
  } finally {
    isLoading.value = false;
  }
};

// Open modal and reset form
const openAddAppointmentModal = () => {
  appointmentForm.value = {
    date: new Date().toISOString().slice(0, 10),
    time: "",
    patient: "",
    serviceId: "",
    therapistDoctor: "",
    status: 36
  };
  errorMessage.value = "";
  successMessage.value = "";
  showModal.value = true;
};

// Update appointment status
const updateAppointmentStatus = async (appointmentId, newStatus) => {
  try {
    isLoading.value = true;
    errorMessage.value = "";
    successMessage.value = "";

    const { data } = await useFetch(`/api/appointments/update`, {
      method: 'PUT',
      body: {
        appointment_id: appointmentId,
        status: newStatus
      }
    });

    if (data.value && data.value.success) {
      successMessage.value = "Appointment status updated successfully!";
      await refreshAppointments(); // Refresh the list
    } else {
      errorMessage.value = data.value?.message || "Failed to update appointment status";
    }
  } catch (error) {
    console.error("Error updating appointment status:", error);
    errorMessage.value = "Error updating appointment status. Please try again.";
  } finally {
    isLoading.value = false;
  }
};

// Handle status change based on action
const handleStatusChange = (appointment, newStatus) => {
  const statusLabels = {
    36: 'Booked',
    37: 'Cancelled',
    38: 'Started',
    39: 'Confirmed Start',
    40: 'Finished',
    41: 'Completed'
  };
  
  // Confirm before updating
  if (confirm(`Are you sure you want to mark this appointment as "${statusLabels[newStatus]}"?`)) {
    updateAppointmentStatus(appointment.id, newStatus);
  }
};

// View appointment details
const viewAppointmentDetails = (appointment) => {
  if (!appointment) {
    console.error("No appointment data provided");
    return;
  }
  
  console.log("Viewing appointment details:", appointment);
  console.log("Parent rate:", appointment.parentRate);
  
  selectedAppointment.value = appointment;
  showDetailsModal.value = true;
};

// Edit appointment
const editAppointment = (appointment) => {
  if (!appointment) {
    console.error("No appointment data provided");
    return;
  }
  
  console.log("Edit appointment called with:", appointment);
  
  selectedAppointment.value = appointment;
  
  // Populate the form with current appointment data
  appointmentForm.value = {
    date: new Date(appointment.date).toISOString().slice(0, 10),
    time: appointment.slotId?.toString() || "",
    patient: appointment.patientId?.toString() || "",
    serviceId: appointment.serviceId?.toString() || "",
    therapistDoctor: appointment.practitionerId?.toString() || "",
    status: appointment.status
  };
  
  console.log("Form populated with:", appointmentForm.value);
  
  isEditing.value = true;
  showEditModal.value = true;
  
  // Delay fetching time slots to prevent immediate background refresh
  setTimeout(() => {
    fetchTimeSlots();
  }, 100);
};

// Save edited appointment
const saveEditedAppointment = async () => {
  try {
    // Validate
    if (!appointmentForm.value.date || 
        !appointmentForm.value.time || 
        !appointmentForm.value.patient || 
        !appointmentForm.value.therapistDoctor || 
        !appointmentForm.value.serviceId) {
      errorMessage.value = "Please fill in all required fields";
      return;
    }

    isLoading.value = true;
    errorMessage.value = "";
    successMessage.value = "";

    // Prepare data
    const appointmentData = {
      appointment_id: selectedAppointment.value.id,
      patient_id: appointmentForm.value.patient,
      practitioner_id: appointmentForm.value.therapistDoctor,
      service_id: appointmentForm.value.serviceId,
      date: appointmentForm.value.date,
      slot_ID: appointmentForm.value.time,
      status: parseInt(appointmentForm.value.status)
    };

    const { data } = await useFetch('/api/appointments/update', {
      method: 'PUT',
      body: appointmentData
    });

    if (data.value && data.value.success) {
      successMessage.value = "Appointment updated successfully!";
      // Reset form
      appointmentForm.value = {
        date: new Date().toISOString().slice(0, 10),
        time: "",
        patient: "",
        serviceId: "",
        therapistDoctor: "",
        status: 36
      };
      
      // Close modal and refresh appointments
      showEditModal.value = false;
      isEditing.value = false;
      await refreshAppointments();
    } else {
      errorMessage.value = data.value?.message || "Failed to update appointment";
    }
  } catch (error) {
    console.error("Error updating appointment:", error);
    errorMessage.value = "Error updating appointment. Please try again.";
  } finally {
    isLoading.value = false;
  }
};

// Open comment modal
const openCommentModal = (appointment, userType) => {
  if (!appointment) {
    console.error("No appointment data provided");
    return;
  }
  
  selectedAppointment.value = appointment;
  commentForm.value = {
    comment: userType === 'parent' ? appointment.parentComment || "" : appointment.therapistDoctorComment || "",
    userType
  };
  showCommentModal.value = true;
};

// Save comment
const saveComment = async () => {
  try {
    isLoading.value = true;
    errorMessage.value = "";
    successMessage.value = "";

    const commentData = {
      appointment_id: selectedAppointment.value.id
    };

    // Add the appropriate comment field based on user type
    if (commentForm.value.userType === 'parent') {
      commentData.parent_comment = commentForm.value.comment;
    } else {
      commentData.therapist_doctor_comment = commentForm.value.comment;
    }

    const { data } = await useFetch('/api/appointments/update', {
      method: 'PUT',
      body: commentData
    });

    if (data.value && data.value.success) {
      successMessage.value = "Comment saved successfully!";
      
      // Update the local data with the new comment
      if (commentForm.value.userType === 'parent') {
        selectedAppointment.value.parentComment = commentForm.value.comment;
      } else {
        selectedAppointment.value.therapistDoctorComment = commentForm.value.comment;
      }
      
      // Also update the raw data
      const appointmentInRawData = rawData.value.find(appt => appt.id === selectedAppointment.value.id);
      if (appointmentInRawData) {
        if (commentForm.value.userType === 'parent') {
          appointmentInRawData.parentComment = commentForm.value.comment;
        } else {
          appointmentInRawData.therapistDoctorComment = commentForm.value.comment;
        }
      }
      
      showCommentModal.value = false;
      
      // Refresh appointments in the background
      await refreshAppointments();
    } else {
      errorMessage.value = data.value?.message || "Failed to save comment";
    }
  } catch (error) {
    console.error("Error saving comment:", error);
    errorMessage.value = "Error saving comment. Please try again.";
  } finally {
    isLoading.value = false;
  }
};

// Helper function to get original data from ID
function getOriginalData(id) {
  return rawData.value.find(appt => appt.id === id);
}

// Open rating modal
const openRatingModal = (appointment) => {
  if (!appointment) {
    console.error("No appointment data provided");
    return;
  }
  
  selectedAppointment.value = appointment;
  ratingForm.value = {
    rating: appointment.parentRate || 0
  };
  showRatingModal.value = true;
};

// Save rating
const saveRating = async () => {
  try {
    isLoading.value = true;
    errorMessage.value = "";
    successMessage.value = "";

    const ratingData = {
      appointment_id: selectedAppointment.value.id,
      parent_rate: Number(ratingForm.value.rating)
    };

    console.log("Saving rating data:", ratingData);

    const { data } = await useLazyFetch('/api/appointments/update', {
      method: 'PUT',
      body: ratingData,
      server: false
    });

    if (data.value && data.value.success) {
      successMessage.value = "Rating saved successfully!";
      
      // Update the local data with the new rating
      selectedAppointment.value.parentRate = Number(ratingForm.value.rating);
      
      // Also update the raw data
      const appointmentInRawData = rawData.value.find(appt => appt.id === selectedAppointment.value.id);
      if (appointmentInRawData) {
        appointmentInRawData.parentRate = Number(ratingForm.value.rating);
      }
      
      showRatingModal.value = false;
      
      // Refresh appointments in the background
      await refreshAppointments();
    } else {
      errorMessage.value = data.value?.message || "Failed to save rating";
    }
  } catch (error) {
    console.error("Error saving rating:", error);
    errorMessage.value = "Error saving rating. Please try again.";
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <ClientOnly>
    <div class="p-4">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-2xl font-bold">Appointment Management</h1>
        <rs-button variant="primary" @click="openAddAppointmentModal">
          <Icon name="material-symbols:add" class="mr-1" /> Add Appointment
        </rs-button>
      </div>

      <div v-if="errorMessage" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
        {{ successMessage }}
      </div>

      <div v-if="appointmentsLoading" class="flex justify-center my-8">
        <Loading />
      </div>

      <rs-card v-else class="p-4">
        <div v-if="appointments.length === 0" class="text-center py-8 text-gray-500">
          No appointments found. Click "Add Appointment" to create a new one.
        </div>
        <rs-table
          v-else
          :data="appointments"
          :columns="columns"
          :options="{ variant: 'default', striped: true, borderless: true, hover: true }"
          :options-advanced="{ sortable: true, responsive: true, filterable: false }"
          advanced
        >
          <!-- Status column -->
          <template v-slot:status="row">
            <span 
              class="px-2 py-1 text-xs font-semibold rounded-full" 
              :class="statusMapping[row.value.status]?.class || 'bg-gray-100 text-gray-800'"
            >
              {{ statusMapping[row.value.status]?.label || 'Unknown' }}
            </span>
          </template>
          
          <!-- Actions column -->
          <template v-slot:action="row">
            <div class="flex justify-center items-center space-x-3 text-gray-600">
              <!-- Edit Icon -->
              <span
                class="relative group cursor-pointer"
                @click="() => editAppointment(getOriginalData(row.value.id))"
              >
                <Icon name="material-symbols:edit" size="22" />
              </span>

              <!-- View Icon -->
              <span
                class="relative group cursor-pointer"
                @click="() => viewAppointmentDetails(getOriginalData(row.value.id))"
              >
                <Icon name="material-symbols:visibility" size="22" />
              </span>
            </div>
          </template>
        </rs-table>
      </rs-card>

      <!-- Add Appointment Modal -->
      <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold">Book New Appointment</h2>
            <button @click="showModal = false" class="text-gray-500 hover:text-gray-700">
              <Icon name="material-symbols:close" size="24" />
            </button>
          </div>

          <FormKit type="form" :actions="false">
            <FormKit type="date" v-model="appointmentForm.date" name="date" label="Date" validation="required" />
            <FormKit type="select" v-model="appointmentForm.patient" name="patient" label="Patient Name" :options="patientOptions" validation="required" />
            <FormKit type="select" v-model="appointmentForm.serviceId" name="serviceId" label="Service" :options="serviceOptions" validation="required" />
            <FormKit type="select" v-model="appointmentForm.therapistDoctor" name="therapistDoctor" label="Therapist/Doctor" :options="therapistDoctorOptions" validation="required" />
            
            <div class="relative">
              <FormKit type="select" v-model="appointmentForm.time" name="time" label="Time Slot" :options="timeSlotOptions" validation="required" :disabled="!appointmentForm.date || !appointmentForm.therapistDoctor || isLoadingSlots" />
              <div v-if="isLoadingSlots" class="absolute right-2 top-8">
                <Icon name="line-md:loading-twotone-loop" class="text-primary" />
              </div>
            </div>
            
            <FormKit type="select" v-model="appointmentForm.status" name="status" label="Status" :options="statusOptions" validation="required" />
          </FormKit>

          <div class="flex justify-end gap-2 mt-4">
            <rs-button variant="secondary-outline" @click="showModal = false">Cancel</rs-button>
            <rs-button variant="primary" @click="saveAppointment" :disabled="isLoading">
              <span v-if="isLoading">Saving...</span>
              <span v-else>Save Appointment</span>
            </rs-button>
          </div>
        </div>
      </div>

      <!-- Appointment Details Modal -->
      <div v-if="showDetailsModal && selectedAppointment" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold">Appointment Details</h2>
            <button @click="showDetailsModal = false" class="text-gray-500 hover:text-gray-700">
              <Icon name="material-symbols:close" size="24" />
            </button>
          </div>

          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-sm text-gray-500">Patient</p>
                <p class="font-medium">{{ selectedAppointment.patientName }}</p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Practitioner</p>
                <p class="font-medium">{{ selectedAppointment.practitionerName }}</p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-sm text-gray-500">Service</p>
                <p class="font-medium">{{ selectedAppointment.serviceName }}</p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Status</p>
                <p>
                  <span 
                    class="px-2 py-1 text-xs font-semibold rounded-full" 
                    :class="statusMapping[selectedAppointment.status]?.class || 'bg-gray-100 text-gray-800'"
                  >
                    {{ statusMapping[selectedAppointment.status]?.label || 'Unknown' }}
                  </span>
                </p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-sm text-gray-500">Date</p>
                <p class="font-medium">{{ selectedAppointment.date }}</p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Time</p>
                <p class="font-medium">{{ selectedAppointment.timeSlot }}</p>
              </div>
            </div>
            
            <!-- Comments Section -->
            <div class="border-t pt-4 mt-4">
              <h3 class="font-semibold mb-2">Comments</h3>
              
              <!-- Parent Comment -->
              <div class="mb-3">
                <div class="flex justify-between items-center">
                  <p class="text-sm text-gray-500">Parent Comment</p>
                  <rs-button size="sm" variant="secondary-outline" @click="openCommentModal(selectedAppointment, 'parent')">
                    <Icon name="material-symbols:edit" size="16" class="mr-1" /> Edit
                  </rs-button>
                </div>
                <p v-if="selectedAppointment.parentComment" class="mt-1 p-2 bg-gray-50 rounded">
                  {{ selectedAppointment.parentComment }}
                </p>
                <p v-else class="mt-1 text-gray-400 italic">No parent comment</p>
              </div>
              
              <!-- Parent Rating -->
              <div class="mb-3">
                <div class="flex justify-between items-center">
                  <p class="text-sm text-gray-500">Parent Rating</p>
                  <rs-button size="sm" variant="secondary-outline" @click="openRatingModal(selectedAppointment)">
                    <Icon name="material-symbols:star" size="16" class="mr-1" /> Rate
                  </rs-button>
                </div>
                <div v-if="Number(selectedAppointment.parentRate) > 0" class="mt-1 p-2 bg-gray-50 rounded flex items-center">
                  <div class="flex">
                    <Icon 
                      v-for="i in 5" 
                      :key="i" 
                      :name="i <= Number(selectedAppointment.parentRate) ? 'material-symbols:star' : 'material-symbols:star-outline'" 
                      class="text-yellow-500" 
                      size="20" 
                    />
                  </div>
                  <span class="ml-2 text-sm">{{ Number(selectedAppointment.parentRate) }} / 5</span>
                </div>
                <p v-else class="mt-1 text-gray-400 italic">
                  No rating provided (parentRate: {{ selectedAppointment.parentRate }}, type: {{ typeof selectedAppointment.parentRate }})
                </p>
              </div>
              
              <!-- Practitioner Comment -->
              <div>
                <div class="flex justify-between items-center">
                  <p class="text-sm text-gray-500">Practitioner Comment</p>
                  <rs-button size="sm" variant="secondary-outline" @click="openCommentModal(selectedAppointment, 'practitioner')">
                    <Icon name="material-symbols:edit" size="16" class="mr-1" /> Edit
                  </rs-button>
                </div>
                <p v-if="selectedAppointment.therapistDoctorComment" class="mt-1 p-2 bg-gray-50 rounded">
                  {{ selectedAppointment.therapistDoctorComment }}
                </p>
                <p v-else class="mt-1 text-gray-400 italic">No practitioner comment</p>
              </div>
            </div>
          </div>

          <div class="mt-6 flex justify-end">
            <rs-button variant="primary" @click="showDetailsModal = false">Close</rs-button>
          </div>
        </div>
      </div>

      <!-- Edit Appointment Modal -->
      <div v-if="showEditModal && selectedAppointment" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold">Edit Appointment</h2>
            <button @click="showEditModal = false" class="text-gray-500 hover:text-gray-700">
              <Icon name="material-symbols:close" size="24" />
            </button>
          </div>

          <FormKit type="form" :actions="false">
            <FormKit type="date" v-model="appointmentForm.date" name="date" label="Date" validation="required" />
            <FormKit type="select" v-model="appointmentForm.patient" name="patient" label="Patient Name" :options="patientOptions" validation="required" />
            <FormKit type="select" v-model="appointmentForm.serviceId" name="serviceId" label="Service" :options="serviceOptions" validation="required" />
            <FormKit type="select" v-model="appointmentForm.therapistDoctor" name="therapistDoctor" label="Therapist/Doctor" :options="therapistDoctorOptions" validation="required" />
            
            <div class="relative">
              <FormKit type="select" v-model="appointmentForm.time" name="time" label="Time Slot" :options="timeSlotOptions" validation="required" :disabled="!appointmentForm.date || !appointmentForm.therapistDoctor || isLoadingSlots" />
              <div v-if="isLoadingSlots" class="absolute right-2 top-8">
                <Icon name="line-md:loading-twotone-loop" class="text-primary" />
              </div>
            </div>
            
            <FormKit type="select" v-model="appointmentForm.status" name="status" label="Status" :options="statusOptions" validation="required" />
          </FormKit>

          <div class="flex justify-end gap-2 mt-4">
            <rs-button variant="secondary-outline" @click="showEditModal = false">Cancel</rs-button>
            <rs-button variant="primary" @click="saveEditedAppointment" :disabled="isLoading">
              <span v-if="isLoading">Saving...</span>
              <span v-else>Save Appointment</span>
            </rs-button>
          </div>
        </div>
      </div>

      <!-- Comment Modal -->
      <div v-if="showCommentModal && selectedAppointment" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold">Add Comment</h2>
            <button @click="showCommentModal = false" class="text-gray-500 hover:text-gray-700">
              <Icon name="material-symbols:close" size="24" />
            </button>
          </div>

          <FormKit type="form" :actions="false">
            <FormKit type="textarea" v-model="commentForm.comment" name="comment" label="Comment" validation="required" />
          </FormKit>

          <div class="flex justify-end gap-2 mt-4">
            <rs-button variant="secondary-outline" @click="showCommentModal = false">Cancel</rs-button>
            <rs-button variant="primary" @click="saveComment" :disabled="isLoading">
              <span v-if="isLoading">Saving...</span>
              <span v-else>Save Comment</span>
            </rs-button>
          </div>
        </div>
      </div>

      <!-- Rating Modal -->
      <div v-if="showRatingModal && selectedAppointment" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold">Rate Appointment</h2>
            <button @click="showRatingModal = false" class="text-gray-500 hover:text-gray-700">
              <Icon name="material-symbols:close" size="24" />
            </button>
          </div>

          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">Rating</label>
            <div class="flex items-center space-x-2">
              <button 
                v-for="i in 5" 
                :key="i" 
                @click="ratingForm.rating = i" 
                class="focus:outline-none"
                type="button"
              >
                <Icon 
                  :name="i <= ratingForm.rating ? 'material-symbols:star' : 'material-symbols:star-outline'" 
                  class="text-yellow-500" 
                  size="36" 
                />
              </button>
            </div>
            <p class="mt-2 text-sm text-gray-500">
              {{ ratingForm.rating > 0 ? `You've selected ${ratingForm.rating} star${ratingForm.rating > 1 ? 's' : ''}` : 'Click on a star to rate' }}
            </p>
          </div>

          <div class="flex justify-end gap-2 mt-4">
            <rs-button variant="secondary-outline" @click="showRatingModal = false">Cancel</rs-button>
            <rs-button variant="primary" @click="saveRating" :disabled="isLoading || ratingForm.rating === 0">
              <span v-if="isLoading">Saving...</span>
              <span v-else>Save Rating</span>
            </rs-button>
          </div>
        </div>
      </div>

      <div class="mt-4 flex justify-center">
        <router-link to="/appointmentManagement/newAppointment/scheduledAppointment">
          <rs-button variant="secondary-outline">
            <Icon name="material-symbols:calendar-month" class="mr-1" /> View Calendar
          </rs-button>
        </router-link>
      </div>
    </div>
    <template #fallback>
      <div class="flex justify-center items-center h-screen">
        <div class="animate-pulse flex flex-col items-center">
          <div class="h-12 w-48 bg-gray-200 rounded mb-4"></div>
          <div class="h-64 w-full max-w-4xl bg-gray-200 rounded"></div>
        </div>
      </div>
    </template>
  </ClientOnly>
</template>
