<script setup>
import { ref, onMounted, watch } from 'vue';
import { useUserStore } from '@/stores/user';
import { useFetch, useLazyFetch } from '#app';
// Import core FullCalendar package first
import '@fullcalendar/core';
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import Loading from '@/components/Loading.vue';

const userStore = useUserStore();

const calendarOptions = ref({
  plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  headerToolbar: {
    left: "prev,next title",
    right: "dayGridMonth,timeGridWeek,listWeek",
  },
  events: [],
  eventClick: handleEventClick,
  eventContent: function(arg) {
    // Create a custom event display with session count, service, and time slot
    const eventEl = document.createElement('div');
    eventEl.classList.add('fc-event-custom-content');
    eventEl.style.padding = '2px';
    eventEl.style.overflow = 'hidden';
    
    // Time slot
    const timeSlotEl = document.createElement('div');
    timeSlotEl.classList.add('text-xs', 'opacity-90', 'mt-1');
    timeSlotEl.innerHTML = `${extractTimeOnly(arg.event.extendedProps.time_slot) || 'Unknown Time'}`;
    eventEl.appendChild(timeSlotEl);
    
    // Patient name
    const titleEl = document.createElement('div');
    titleEl.classList.add('font-medium');
    titleEl.innerHTML = arg.event.extendedProps.patient_name || 'Unknown Patient';
    eventEl.appendChild(titleEl);
    
    // Service name
    const serviceEl = document.createElement('div');
    serviceEl.classList.add('text-xs', 'opacity-80');
    serviceEl.innerHTML = arg.event.extendedProps.service_name || 'Unknown Service';
    eventEl.appendChild(serviceEl);
    
    // Practitioner name with Admin indicator
    const practitionerEl = document.createElement('div');
    practitionerEl.classList.add('text-xs', 'font-semibold');
    const practitionerName = arg.event.extendedProps.practitioner_name || 'Unknown Practitioner';
    const isAdmin = !arg.event.extendedProps.practitioner_id || arg.event.extendedProps.practitioner_id === 'admin';
    
    if (isAdmin) {
      practitionerEl.innerHTML = `<span style="color: #ea580c;">Admin</span>`;
      practitionerEl.style.border = '1px solid #ea580c';
      practitionerEl.style.borderRadius = '4px';
      practitionerEl.style.padding = '1px 4px';
      practitionerEl.style.backgroundColor = '#fed7aa';
    } else {
      practitionerEl.innerHTML = practitionerName;
    }
    eventEl.appendChild(practitionerEl);
    
    // Session number
    const sessionEl = document.createElement('div');
    sessionEl.classList.add('text-xs', 'font-semibold');
    sessionEl.innerHTML = `Session ${arg.event.extendedProps.session_number || 1}`;
    eventEl.appendChild(sessionEl);
    
    return { domNodes: [eventEl] };
  }
});

const fetchAppointments = async () => {
  const { data, error } = await useFetch('/api/appointments/list');

  if (error.value) {
    console.error('Error fetching appointments:', error.value);
    isPageLoading.value = false; // Set loading to false even on error
    return;
  }

  const appointments = data.value.data || [];
  
  // Filter out cancelled appointments (status 37)
  const activeAppointments = appointments.filter(appt => 
    appt.extendedProps.status !== 37
  );
  
  calendarOptions.value.events = activeAppointments.map(appt => ({
    id: appt.id,
    title: appt.title,
    start: appt.start,
    end: appt.end,
    allDay: false,
    backgroundColor: getStatusColor(appt.extendedProps.status),
    borderColor: getStatusColor(appt.extendedProps.status),
    textColor: '#fff',
    extendedProps: appt.extendedProps,
  }));
  
  // Set page loading to false after appointments are loaded
  isPageLoading.value = false;
};

// Function to handle clicking on a calendar event
function handleEventClick(info) {
  console.log("Calendar event clicked:", info.event);
  
  const eventId = info.event.id;
  
  // Try to find the appointment in the raw data first
  const appointment = getOriginalData(eventId);
  
  if (appointment) {
    // If found in raw data, use that
    selectedAppointment.value = appointment;
    showDetailsModal.value = true;
  } else {
    // If not found in raw data, create a formatted appointment object from the event data
    const eventData = info.event;
    const extendedProps = eventData.extendedProps;
    
    // Create a properly formatted appointment object from the event data
    const formattedAppointment = {
      id: eventData.id,
      patientName: extendedProps.patient_name || 'Unknown Patient',
      practitionerName: extendedProps.practitioner_name || 'Unknown Practitioner',
      serviceName: extendedProps.service_name || 'Unknown Service',
      date: new Date(eventData.start).toLocaleDateString(),
      originalDate: eventData.start.toISOString(),
      timeSlot: extendedProps.time_slot || 'Unknown Time',
      status: extendedProps.status || 36,
      patientId: extendedProps.patient_id,
      practitionerId: extendedProps.practitioner_id,
      serviceId: extendedProps.service_id,
      slotId: extendedProps.slot_ID,
      parentComment: extendedProps.parent_comment,
      therapistDoctorComment: extendedProps.therapist_doctor_comment,
      parentRate: extendedProps.parent_rate || 0,
      sessionNumber: extendedProps.session_number || 1,
      rawExtendedProps: extendedProps
    };
    
    // Add this appointment to the raw data for future reference
    rawData.value.push(formattedAppointment);
    
    // Set as selected appointment and show details modal
    selectedAppointment.value = formattedAppointment;
    showDetailsModal.value = true;
  }
}

// Function to get color based on status
function getStatusColor(status) {
  const statusColors = {
    36: '#14452F', // Booked - Green
    38: '#1976D2', // Started - Blue
    39: '#388E3C', // Confirmed Start - Green
    40: '#7B1FA2', // Finished - Purple
    41: '#303F9F', // Completed - Indigo
  };
  return statusColors[status] || '#14452F';
}

onMounted(() => {
  fetchAppointments();
  
  // Set a timeout to prevent infinite loading
  setTimeout(() => {
    isPageLoading.value = false;
  }, 10000); // 10 second timeout
});

const currentUserId = userStore.userID || 1; // fallback to 1 if not set

// Loading states
const isLoading = ref(false);
const isLoadingSlots = ref(false); // Separate loading state for time slots
const isPageLoading = ref(true); // Page loading state for initial load
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

// Patient search state
const patientSearchText = ref('');
const showPatientDropdown = ref(false);
const filteredPatients = ref([]);

// Form data
const appointmentForm = ref({
  date: new Date().toISOString().slice(0, 10),
  time: "",
  patient: "",
  serviceId: "",
  therapistDoctor: "",
  status: 36 // Added status field
});

// Patient session checking
const patientSessionInfo = ref(null);
const isCheckingSessions = ref(false);

// Rating form
const ratingForm = ref({
  rating: 0
});

// Options
const patientOptions = ref([{ label: "--- Please select ---", value: "" }]);
const serviceOptions = ref([
  { label: "--- Please select ---", value: "" },
  // { label: "Consultation", value: "1" },
  // { label: "Therapy", value: "2" }
]);
const therapistDoctorOptions = ref([
  { label: "--- Please select ---", value: "" },
  { label: "Admin", value: "admin" } // Add Admin as first option
]);
const timeSlotOptions = ref([{ label: "--- Please select ---", value: "" }]);

// Table columns
const columns = [
  { name: 'no', label: 'No' },
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

// Fetch appointments with a custom refresh function to ensure data is properly updated
const { data: appointmentsData, pending: appointmentsLoading, refresh: _refreshAppointments } = useLazyFetch('/api/appointments/list', {
  immediate: true,
  server: false,
  key: 'appointments-list',
  transform: (response) => {
    if (response && response.success) {
      // Store raw data
      const rawAppointments = response.data.map(appt => {
        console.log("API appointment data:", appt);
        console.log("Original date from API:", appt.start);
        console.log("Formatted date:", new Date(appt.start).toLocaleDateString());
        
        return {
          id: appt.id,
          patientName: appt.extendedProps.patient_name || 'Unknown Patient',
          practitionerName: appt.extendedProps.practitioner_name || 'Unknown Practitioner',
          serviceName: appt.extendedProps.service_name || 'Unknown Service',
          date: new Date(appt.start).toLocaleDateString(),
          originalDate: appt.start, // Store the original date string
          timeSlot: appt.extendedProps.time_slot || 'Unknown Time',
          status: appt.extendedProps.status || 36,
          patientId: appt.extendedProps.patient_id,
          practitionerId: appt.extendedProps.practitioner_id,
          serviceId: appt.extendedProps.service_id,
          slotId: appt.extendedProps.slot_ID,
          parentComment: appt.extendedProps.parent_comment,
          therapistDoctorComment: appt.extendedProps.therapist_doctor_comment,
          parentRate: appt.extendedProps.parent_rate || 0,
          sessionNumber: appt.extendedProps.session_number || 1,
          rawExtendedProps: appt.extendedProps
        };
      });
      
      rawData.value = rawAppointments;
      
      // Create the table data from raw data with index as No.
      return rawAppointments.map((appt, index) => {
        // Create a new object without the id property in the visible data
        const visibleData = {
          no: index + 1,
          patientName: appt.patientName,
          practitionerName: appt.practitionerName,
          serviceName: appt.serviceName,
          date: appt.date,
          timeSlot: appt.timeSlot,
          status: appt.status,
          action: 'edit'
        };
        
        // Add id as a non-enumerable property so it's accessible for actions but not displayed
        Object.defineProperty(visibleData, 'id', {
          value: appt.id,
          enumerable: false
        });
        
        return visibleData;
      });
    }
    return [];
  }
});

// Create an enhanced refresh function that updates both list and calendar
const refreshAppointments = async () => {
  await _refreshAppointments();
  await fetchAppointments();
};

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
        practitioners: response.data.practitioners,
        services: response.data.services
      };
    }
    return { patients: [], practitioners: [], services: [] };
  }
});

// Set options from the fetched data
watch(optionsData, (newData) => {
  if (newData) {
    patientOptions.value = [
      { label: "--- Please select ---", value: "" },
      ...newData.patients
    ];
    serviceOptions.value = [
      { label: "--- Please select ---", value: "" },
      ...newData.services
    ];
    therapistDoctorOptions.value = [
      { label: "--- Please select ---", value: "" },
      { label: "Admin", value: "admin" }, // Keep Admin as first option
      ...newData.practitioners
    ];
  }
});

// Update fetchTimeSlots to handle admin slots (5 per day)
const fetchTimeSlots = async (date, practitionerId) => {
  if (!date) {
    console.error("Missing date parameter for fetching time slots");
    timeSlotOptions.value = [{ label: "--- Please select ---", value: "" }];
    return;
  }
  
  isLoadingSlots.value = true;
  
  try {
    // If practitioner is Admin, fetch admin slots (5 per day)
    if (practitionerId === 'admin') {
      const { data, error } = await useFetch('/api/appointments/adminSlots', {
        method: 'GET',
        params: { date }
      });
      
      if (error.value) {
        console.error('Error fetching admin slots:', error.value);
        timeSlotOptions.value = [{ label: "--- Please select ---", value: "" }];
        return;
      }
      
      if (data.value && data.value.success) {
        const slots = data.value.data || [];
        timeSlotOptions.value = [
          { label: "--- Please select ---", value: "" },
          ...slots
            .filter(slot => slot.isAvailable)
            .map(slot => ({
              label: slot.title || slot.value,
              value: slot.lookupID.toString()
            }))
        ];
        
        // If no available slots, show a message
        if (timeSlotOptions.value.length === 1) {
          errorMessage.value = "No available admin slots for the selected date (maximum 5 slots per day)";
        }
      } else {
        errorMessage.value = data.value?.message || "Failed to load admin slots";
        timeSlotOptions.value = [{ label: "--- Please select ---", value: "" }];
      }
    } else {
      // Original logic for regular practitioners
      if (!practitionerId) {
        console.error("Missing practitioner ID for fetching time slots");
        timeSlotOptions.value = [{ label: "--- Please select ---", value: "" }];
        return;
      }
      
      const { data, error } = await useFetch('/api/appointments/slots', {
        method: 'GET',
        params: {
          date,
          practitioner_id: practitionerId
        }
      });
      
      if (error.value) {
        console.error('Error fetching time slots:', error.value);
        timeSlotOptions.value = [{ label: "--- Please select ---", value: "" }];
        return;
      }
      
      if (data.value && data.value.success) {
        const slots = data.value.data || [];
        timeSlotOptions.value = [
          { label: "--- Please select ---", value: "" },
          ...slots
            .filter(slot => slot.isAvailable)
            .map(slot => ({
              label: slot.title || slot.value,
              value: slot.lookupID.toString()
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
    }
  } catch (err) {
    console.error('Error fetching time slots:', err);
    timeSlotOptions.value = [{ label: "--- Please select ---", value: "" }];
  } finally {
    isLoadingSlots.value = false;
  }
};

// Function to check patient available sessions
const checkPatientSessions = async (patientId) => {
  if (!patientId) {
    patientSessionInfo.value = null;
    return;
  }
  
  isCheckingSessions.value = true;
  patientSessionInfo.value = null;
  
  try {
    const { data, error } = await useFetch('/api/appointments/checkPatientSessions', {
      method: 'GET',
      params: {
        patient_id: patientId
      }
    });
    
    if (error.value) {
      console.error('Error checking patient sessions:', error.value);
      errorMessage.value = 'Failed to check patient sessions';
      return;
    }
    
    if (data.value && data.value.success) {
      patientSessionInfo.value = data.value.data;
      
      // If patient has no sessions, show error message
      if (!data.value.data.can_book_appointment) {
        errorMessage.value = data.value.message;
      } else {
        // Clear any previous error messages if patient can book
        if (errorMessage.value && errorMessage.value.includes('no available sessions')) {
          errorMessage.value = '';
        }
      }
    } else {
      errorMessage.value = data.value?.message || 'Failed to check patient sessions';
    }
  } catch (err) {
    console.error('Error checking patient sessions:', err);
    errorMessage.value = 'Error checking patient sessions';
  } finally {
    isCheckingSessions.value = false;
  }
};

// Add watchers for date and practitioner changes to fetch time slots
watch([
  () => appointmentForm.value.date,
  () => appointmentForm.value.therapistDoctor
], ([newDate, newPractitioner]) => {
  console.log("Watcher triggered - Date:", newDate, "Practitioner:", newPractitioner);
  if (newDate && newPractitioner) {
    console.log("Both date and practitioner selected, fetching time slots");
    fetchTimeSlots(newDate, newPractitioner);
    
    // If selecting admin, also check admin slots count
    if (newPractitioner === 'admin') {
      console.log("Admin selected, checking admin slots count");
      checkAdminSlotsCount(newDate);
    }
  } else {
    console.log("Missing date or practitioner, resetting time slots");
    // Reset time slots if either date or practitioner is not selected
    timeSlotOptions.value = [{ label: "--- Please select ---", value: "" }];
    appointmentForm.value.time = "";
  }
});

// Add watcher for date changes to check admin slots count
watch(() => appointmentForm.value.date, (newDate) => {
  console.log("Date watcher triggered:", newDate, "Current therapistDoctor:", appointmentForm.value.therapistDoctor);
  if (newDate && appointmentForm.value.therapistDoctor === 'admin') {
    console.log("Date changed and Admin is selected, checking admin slots count");
    checkAdminSlotsCount(newDate);
  }
});

// Add watcher for patient selection to check sessions
watch(() => appointmentForm.value.patient, (newPatientId) => {
  if (newPatientId) {
    checkPatientSessions(newPatientId);
  } else {
    patientSessionInfo.value = null;
  }
});

// Add watcher for patient search text
watch(patientSearchText, (newText) => {
  if (newText) {
    filterPatients(newText);
    showPatientDropdown.value = true;
  } else {
    filteredPatients.value = [];
    showPatientDropdown.value = false;
  }
});

// Update saveAppointment to handle admin appointments
const saveAppointment = async () => {
  try {
    console.log("saveAppointment called with form data:", appointmentForm.value);
    console.log("adminSlotsCount:", adminSlotsCount.value);
    console.log("maxAdminSlotsPerDay:", maxAdminSlotsPerDay);
    
    // Validate
    if (!appointmentForm.value.date || 
        !appointmentForm.value.patient || 
        !appointmentForm.value.therapistDoctor || 
        !appointmentForm.value.serviceId) {
      errorMessage.value = "Please fill in all required fields";
      console.log("Validation failed - missing required fields");
      return;
    }
    
    // Only require time slot for non-admin appointments
    if (appointmentForm.value.therapistDoctor !== 'admin' && !appointmentForm.value.time) {
      errorMessage.value = "Please select a time slot";
      console.log("Validation failed - missing time slot for non-admin appointment");
      return;
    }

    // Check if patient has available sessions
    if (patientSessionInfo.value && !patientSessionInfo.value.can_book_appointment) {
      errorMessage.value = `Cannot create appointment. Patient ${patientSessionInfo.value.patient_name} has no available sessions (${patientSessionInfo.value.available_sessions}). Please purchase more sessions first.`;
      console.log("Validation failed - patient has no available sessions");
      return;
    }

    // Check admin slots limit
    if (appointmentForm.value.therapistDoctor === 'admin' && adminSlotsCount.value >= maxAdminSlotsPerDay) {
      errorMessage.value = `Cannot create admin appointment. Maximum of ${maxAdminSlotsPerDay} admin slots per day reached for ${appointmentForm.value.date}. Please select a different date or assign existing admin appointments first.`;
      console.log("Validation failed - admin slots limit reached");
      return;
    }

    console.log("All validations passed, proceeding to create appointment");
    isLoading.value = true;
    errorMessage.value = "";
    successMessage.value = "";

    // Prepare data
    const appointmentData = {
      patient_id: appointmentForm.value.patient,
      practitioner_id: appointmentForm.value.therapistDoctor === 'admin' ? null : appointmentForm.value.therapistDoctor,
      book_by: currentUserId,
      service_id: appointmentForm.value.serviceId,
      date: appointmentForm.value.date,
      slot_ID: appointmentForm.value.therapistDoctor === 'admin' ? null : appointmentForm.value.time,
      status: 36, // Booked status
      is_admin_appointment: appointmentForm.value.therapistDoctor === 'admin' // Flag for admin appointments
    };

    console.log("Sending appointment data to API:", appointmentData);

    const { data } = await useFetch('/api/appointments/create', {
      method: 'POST',
      body: appointmentData
    });

    console.log("API response:", data.value);

    if (data.value && data.value.success) {
      if (appointmentForm.value.therapistDoctor === 'admin') {
        successMessage.value = "Admin appointment created successfully! One session has been deducted from the patient's available sessions. You can assign this to a doctor/therapist on the appointment date.";
        // Update admin slots count
        adminSlotsCount.value += 1;
        console.log("Admin appointment created successfully, updated adminSlotsCount to:", adminSlotsCount.value);
      } else {
        successMessage.value = "Appointment created successfully! One session has been deducted from the patient's available sessions.";
        console.log("Regular appointment created successfully");
      }
      
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
       
       // Reset patient session info and admin slots count
       patientSessionInfo.value = null;
       adminSlotsCount.value = 0;
       
       // Reset patient search
       patientSearchText.value = '';
       showPatientDropdown.value = false;
       filteredPatients.value = [];
       
       // Close modal and refresh appointments
       showModal.value = false;
       console.log("Modal closed, refreshing appointments");
       await refreshAppointments(); // Now refreshes both list and calendar
    } else {
      errorMessage.value = data.value?.message || "Failed to create appointment";
      console.log("API call failed:", data.value);
    }
  } catch (error) {
    console.error("Error saving appointment:", error);
    errorMessage.value = "Error creating appointment. Please try again.";
  } finally {
    isLoading.value = false;
  }
};

// Function to open the add appointment modal
const openAddAppointmentModal = () => {
  console.log("openAddAppointmentModal called");
  // Reset form
  appointmentForm.value = {
    date: new Date().toISOString().slice(0, 10),
    time: "",
    patient: "",
    serviceId: "",
    therapistDoctor: "",
    status: "36" // Default to booked status
  };
  
  console.log("Form reset to:", appointmentForm.value);
  
  // Reset patient session info and admin slots count
  patientSessionInfo.value = null;
  adminSlotsCount.value = 0;
  
  // Reset patient search
  patientSearchText.value = '';
  showPatientDropdown.value = false;
  filteredPatients.value = [];
  
  console.log("Reset patientSessionInfo and adminSlotsCount");
  
  isEditing.value = false;
  showModal.value = true;
  
  console.log("Modal opened, showModal set to:", showModal.value);
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
      // Check if the status was changed to "Cancelled" (37)
      if (newStatus === 37) {
        successMessage.value = "Appointment cancelled successfully! One session has been added back to the patient's available sessions.";
      } else if (newStatus === 41) {
        successMessage.value = "Appointment marked as completed!";
      } else {
        successMessage.value = "Appointment status updated successfully!";
      }
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
  
  // Special confirmation for cancelled status
  if (newStatus === 37) {
    if (confirm(`Are you sure you want to mark this appointment as "Cancelled"? This will add back one session to the patient's available sessions.`)) {
      updateAppointmentStatus(appointment.id, newStatus);
    }
  } else if (newStatus === 41) {
    if (confirm(`Are you sure you want to mark this appointment as "Completed"?`)) {
      updateAppointmentStatus(appointment.id, newStatus);
    }
  } else {
    // Confirm before updating for other statuses
    if (confirm(`Are you sure you want to mark this appointment as "${statusLabels[newStatus]}"?`)) {
      updateAppointmentStatus(appointment.id, newStatus);
    }
  }
};

// Update the viewAppointmentDetails function to work with the restored table structure
const viewAppointmentDetails = (row) => {
  console.log("View appointment details called with:", row);
  
  // Handle both direct row objects and row.value objects
  const id = row.id || (row.value && row.value.id);
  
  if (!id) {
    console.error("Cannot find appointment ID in:", row);
    return;
  }
  
  // Find the appointment in the raw data using the row id
  const appointment = getOriginalData(id);
  if (appointment) {
    selectedAppointment.value = appointment;
    showDetailsModal.value = true;
  } else {
    console.error("Appointment not found for ID:", id);
  }
};

// Update the editAppointment function to work with the restored table structure
const editAppointment = (id) => {
  console.log("Edit appointment called with id:", id);
  
  // Handle both direct id and id from row.value
  const appointmentId = typeof id === 'object' ? (id.id || (id.value && id.value.id)) : id;
  
  if (!appointmentId) {
    console.error("Cannot find appointment ID:", id);
    return;
  }
  
  const appointment = getOriginalData(appointmentId);
  if (appointment) {
    selectedAppointment.value = appointment;
    
    // Get the original date from the stored original date or raw extended props
    const originalDate = appointment.originalDate ? 
      appointment.originalDate.split('T')[0] : 
      new Date().toISOString().slice(0, 10);
    
    console.log("Original appointment date:", appointment.date);
    console.log("Original ISO date:", originalDate);
    
    // Set form values
    appointmentForm.value = {
      date: originalDate,
      patient: appointment.patientId?.toString() || "",
      serviceId: appointment.serviceId?.toString() || "",
      therapistDoctor: appointment.practitionerId?.toString() || (appointment.isAdminAppointment ? "admin" : ""),
      time: appointment.slotId?.toString() || "",
      status: appointment.status?.toString() || "36"
    };
    
    // Set patient search text for display
    if (appointment.patientId) {
      const patientOption = optionsData.value?.patients?.find(p => p.value === appointment.patientId?.toString());
      if (patientOption) {
        patientSearchText.value = patientOption.label;
      }
    }
    
    isEditing.value = true;
    showEditModal.value = true;
    
    // Check patient sessions when editing
    if (appointmentForm.value.patient) {
      checkPatientSessions(appointmentForm.value.patient);
    }
    
    // Load time slots for the selected date and practitioner
    if (appointmentForm.value.date && appointmentForm.value.therapistDoctor) {
      fetchTimeSlots(appointmentForm.value.date, appointmentForm.value.therapistDoctor);
    }
  } else {
    console.error("Appointment not found for ID:", appointmentId);
  }
};

// Save edited appointment
const saveEditedAppointment = async () => {
  try {
    // Validate
    if (!appointmentForm.value.date || 
        !appointmentForm.value.patient || 
        !appointmentForm.value.therapistDoctor || 
        !appointmentForm.value.serviceId) {
      errorMessage.value = "Please fill in all required fields";
      return;
    }
    
    // Only require time slot for non-admin appointments
    if (appointmentForm.value.therapistDoctor !== 'admin' && !appointmentForm.value.time) {
      errorMessage.value = "Please select a time slot";
      return;
    }

    // Check if patient has available sessions
    if (patientSessionInfo.value && !patientSessionInfo.value.can_book_appointment) {
      errorMessage.value = `Cannot update appointment. Patient ${patientSessionInfo.value.patient_name} has no available sessions (${patientSessionInfo.value.available_sessions}). Please purchase more sessions first.`;
      return;
    }

    // Check admin slots limit for new admin appointments
    if (appointmentForm.value.therapistDoctor === 'admin') {
      // If this was previously not an admin appointment, check the limit
      const wasAdmin = isAdminAppointment(selectedAppointment.value);
      if (!wasAdmin && adminSlotsCount.value >= maxAdminSlotsPerDay) {
        errorMessage.value = `Cannot convert to admin appointment. Maximum of ${maxAdminSlotsPerDay} admin slots per day reached for ${appointmentForm.value.date}. Please select a different date or assign existing admin appointments first.`;
        return;
      }
    }

    isLoading.value = true;
    errorMessage.value = "";
    successMessage.value = "";

    // Prepare data
    const appointmentData = {
      appointment_id: selectedAppointment.value.id,
      patient_id: appointmentForm.value.patient,
      practitioner_id: appointmentForm.value.therapistDoctor === 'admin' ? null : appointmentForm.value.therapistDoctor,
      service_id: appointmentForm.value.serviceId,
      date: appointmentForm.value.date,
      slot_ID: appointmentForm.value.therapistDoctor === 'admin' ? null : appointmentForm.value.time,
      status: parseInt(appointmentForm.value.status),
      is_admin_appointment: appointmentForm.value.therapistDoctor === 'admin'
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
       
       // Reset patient search
       patientSearchText.value = '';
       showPatientDropdown.value = false;
       filteredPatients.value = [];
       
       // Close modal and refresh appointments
       showEditModal.value = false;
       isEditing.value = false;
       await refreshAppointments(); // Now refreshes both list and calendar
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

// Function to extract only the time part from the time slot string
function extractTimeOnly(timeSlot) {
  if (!timeSlot) return 'Unknown Time';
  
  // Extract the time part after the colon (e.g., "Slot 2 : 10.00 am - 11.00 am" -> "10.00 am - 11.00 am")
  const colonIndex = timeSlot.indexOf(':');
  if (colonIndex !== -1) {
    return timeSlot.substring(colonIndex + 1).trim();
  }
  
  return timeSlot;
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

// Add a state to track active tab
const activeTab = ref('calendar'); // Default to calendar view

// Add state for calendar filtering
const calendarFilter = ref('all'); // Default to show all appointments

// Add state for delete and cancel functionality
const showDeleteModal = ref(false);



// Add state for admin slots tracking
const adminSlotsCount = ref(0);
const maxAdminSlotsPerDay = 5;

// Watch for activeTab changes to refresh the calendar when switching to calendar view
watch(() => activeTab.value, (newTab) => {
  if (newTab === 'calendar') {
    fetchAppointments();
  }
});

// Function to confirm deletion from the table view
const confirmDeleteAppointment = (id) => {
  // Find the appointment in the raw data
  const appointment = rawData.value.find(appt => appt.id === id);
  if (appointment) {
    selectedAppointment.value = appointment;
    showDeleteModal.value = true;
  } else {
    errorMessage.value = "Appointment not found";
  }
};

// Function to delete an appointment (soft delete)
const deleteAppointment = async () => {
  if (!selectedAppointment.value) return;
  
  isLoading.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  
  try {
    const { data, error } = await useFetch(`/api/appointments/delete?id=${selectedAppointment.value.id}`, {
      method: 'DELETE'
    });
    
    if (error.value) {
      errorMessage.value = `Error deleting appointment: ${error.value.message}`;
    } else if (data.value && data.value.success) {
      successMessage.value = 'Appointment deleted successfully';
      showDeleteModal.value = false;
      showDetailsModal.value = false;
      
      // Remove the appointment from local data
      const index = rawData.value.findIndex(appt => appt.id === selectedAppointment.value.id);
      if (index !== -1) {
        rawData.value.splice(index, 1);
      }
      
      // Refresh both list and calendar views
      await refreshAppointments();
    } else {
      errorMessage.value = data.value?.message || 'Failed to delete appointment';
    }
  } catch (err) {
    errorMessage.value = `An error occurred: ${err.message}`;
  } finally {
    isLoading.value = false;
  }
};

// Function to cancel an appointment (update status to 37)
const cancelAppointment = async () => {
  if (!selectedAppointment.value) return;
  
  isLoading.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  
  try {
    const { data, error } = await useFetch('/api/appointments/update', {
      method: 'PUT',
      body: {
        appointment_id: selectedAppointment.value.id,
        status: 37 // Cancelled status
      }
    });
    
    if (error.value) {
      errorMessage.value = `Error cancelling appointment: ${error.value.message}`;
    } else if (data.value && data.value.success) {
      successMessage.value = 'Appointment cancelled successfully! One session has been added back to the patient\'s available sessions.';
      
      // Update the appointment in the raw data
      const index = rawData.value.findIndex(appt => appt.id === selectedAppointment.value.id);
      if (index !== -1) {
        rawData.value[index].status = 37; // Update to cancelled status
      }
      
      showDetailsModal.value = false;
      showDeleteModal.value = false;
      
      // Refresh both the list and calendar data
      await refreshAppointments();
    } else {
      errorMessage.value = data.value?.message || 'Failed to cancel appointment';
    }
  } catch (err) {
    errorMessage.value = `An error occurred: ${err.message}`;
  } finally {
    isLoading.value = false;
  }
};



// Helper function to check if appointment is admin appointment
const isAdminAppointment = (appointment) => {
  return appointment && (
    appointment.practitionerId === null || 
    appointment.practitionerId === 'admin' || 
    appointment.isAdminAppointment ||
    appointment.practitionerName === 'Admin'
  );
};



// Helper function to check if appointment is today or in the future
const isAppointmentTodayOrFuture = (appointment) => {
  if (!appointment) return false;
  
  const appointmentDate = new Date(appointment.originalDate || appointment.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return appointmentDate >= today;
};

// Helper function to format date for display
const formatAppointmentDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  today.setHours(0, 0, 0, 0);
  const appointmentDate = new Date(date);
  appointmentDate.setHours(0, 0, 0, 0);
  
  if (appointmentDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (appointmentDate.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString();
  }
};

// Function to apply calendar filter
const applyCalendarFilter = () => {
  if (calendarFilter.value === 'all') {
    // Show all appointments
    fetchAppointments();
  } else if (calendarFilter.value === 'admin') {
    // Show only admin appointments
    const adminAppointments = rawData.value.filter(appt => isAdminAppointment(appt));
    calendarOptions.value.events = adminAppointments.map(appt => ({
      id: appt.id,
      title: appt.patientName,
      start: appt.originalDate || appt.date,
      end: appt.originalDate || appt.date,
      allDay: false,
      backgroundColor: '#ea580c', // Orange color for admin appointments
      borderColor: '#ea580c',
      textColor: '#fff',
      extendedProps: {
        patient_name: appt.patientName,
        practitioner_name: 'Admin',
        service_name: appt.serviceName,
        time_slot: appt.timeSlot,
        status: appt.status,
        patient_id: appt.patientId,
        practitioner_id: null,
        service_id: appt.serviceId,
        slot_ID: appt.slotId,
        parent_comment: appt.parentComment,
        therapist_doctor_comment: appt.therapistDoctorComment,
        parent_rate: appt.parentRate,
        session_number: appt.sessionNumber
      },
    }));
  } else if (calendarFilter.value === 'assigned') {
    // Show only assigned appointments
    const assignedAppointments = rawData.value.filter(appt => !isAdminAppointment(appt));
    calendarOptions.value.events = assignedAppointments.map(appt => ({
      id: appt.id,
      title: appt.patientName,
      start: appt.originalDate || appt.date,
      end: appt.originalDate || appt.date,
      allDay: false,
      backgroundColor: getStatusColor(appt.status),
      borderColor: getStatusColor(appt.status),
      textColor: '#fff',
      extendedProps: {
        patient_name: appt.patientName,
        practitioner_name: appt.practitionerName,
        service_name: appt.serviceName,
        time_slot: appt.timeSlot,
        status: appt.status,
        patient_id: appt.patientId,
        practitioner_id: appt.practitionerId,
        service_id: appt.serviceId,
        slot_ID: appt.slotId,
        parent_comment: appt.parentComment,
        therapist_doctor_comment: appt.therapistDoctorComment,
        parent_rate: appt.parentRate,
        session_number: appt.sessionNumber
      },
    }));
  }
};

// Function to check admin slots count for a specific date
const checkAdminSlotsCount = async (date) => {
  console.log("checkAdminSlotsCount called with date:", date);
  if (!date) {
    console.log("No date provided, returning early");
    return;
  }
  
  try {
    console.log("Fetching admin slots count for date:", date);
    const { data, error } = await useFetch('/api/appointments/adminSlotsCount', {
      method: 'GET',
      params: { date }
    });
    
    console.log("Admin slots count API response:", { data: data.value, error: error.value });
    
    if (error.value) {
      console.error('Error checking admin slots count:', error.value);
      adminSlotsCount.value = 0;
      return;
    }
    
    if (data.value && data.value.success) {
      adminSlotsCount.value = data.value.data.count || 0;
      console.log("Admin slots count updated to:", adminSlotsCount.value);
    } else {
      adminSlotsCount.value = 0;
      console.log("Admin slots count API returned no success, setting to 0");
    }
  } catch (err) {
    console.error('Error checking admin slots count:', err);
    adminSlotsCount.value = 0;
  }
};

// Function to filter patients based on search text
const filterPatients = (searchText) => {
  if (!searchText || !optionsData.value?.patients) {
    filteredPatients.value = [];
    return;
  }
  
  const searchLower = searchText.toLowerCase();
  filteredPatients.value = optionsData.value.patients.filter(patient => {
    const nameMatch = patient.label?.toLowerCase().includes(searchLower);
    const icMatch = patient.ic?.toLowerCase().includes(searchLower);
    return nameMatch || icMatch;
  });
};

// Function to select a patient
const selectPatient = (patient) => {
  appointmentForm.value.patient = patient.value;
  patientSearchText.value = patient.label;
  showPatientDropdown.value = false;
  
  // Check patient sessions when a patient is selected
  if (patient.value) {
    checkPatientSessions(patient.value);
  }
};

// Function to clear patient selection
const clearPatientSelection = () => {
  appointmentForm.value.patient = '';
  patientSearchText.value = '';
  showPatientDropdown.value = false;
  patientSessionInfo.value = null;
};

</script>

<template>
  <ClientOnly>
    <!-- Page Loading State -->
    <div v-if="isPageLoading" class="flex justify-center items-center h-screen">
      <div class="text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
        <p class="text-gray-500 text-lg">Loading calendar...</p>
        <p class="text-gray-400 text-sm mt-2">Please wait while we fetch your appointment data</p>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else>
      <div class="p-4">
        <div class="flex justify-between items-center mb-4">
          <h1 class="text-2xl font-bold">Appointments Management</h1>
          <!-- Only show New Appointment button for non-doctors -->
          <rs-button v-if="!userStore.isDoctor" variant="primary" @click="openAddAppointmentModal">
            <Icon name="material-symbols:add" class="mr-1" /> New Appointment
          </rs-button>
        </div>

        <!-- Tab Navigation - Only show for non-doctors -->
        <div v-if="!userStore.isDoctor" class="flex border-b mb-4">
           <button 
            @click="activeTab = 'calendar'" 
            class="py-2 px-4 focus:outline-none"
            :class="activeTab === 'calendar' ? 'border-b-2 border-primary text-primary font-medium' : 'border-b-2 border-transparent'"
          >
            <Icon name="material-symbols:calendar-month" class="mr-1" /> Calendar View
          </button>
          <button 
            @click="activeTab = 'list'" 
            class="py-2 px-4 mr-2 focus:outline-none"
            :class="activeTab === 'list' ? 'border-b-2 border-primary text-primary font-medium' : 'border-b-2 border-transparent'"
          >
            <Icon name="material-symbols:list" class="mr-1" /> Appointment List
          </button>
        </div>

        <!-- Admin Appointments Summary - Only show for non-doctors -->
        <div v-if="!userStore.isDoctor" class="mb-6">
          <rs-card class="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
            <h3 class="text-lg font-semibold text-blue-800 mb-3 flex items-center">
              <Icon name="material-symbols:admin-panel-settings" class="mr-2" />
              Admin Appointments Summary
            </h3>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <!-- Total Admin Appointments -->
              <div class="bg-white p-3 rounded-lg border border-blue-200">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm text-gray-600">Total Admin Appointments</p>
                    <p class="text-2xl font-bold text-blue-600">
                      {{ rawData.filter(appt => isAdminAppointment(appt)).length }}
                    </p>
                  </div>
                  <Icon name="material-symbols:calendar-today" class="text-blue-500" size="24" />
                </div>
              </div>
              
              <!-- Pending Assignment -->
              <div class="bg-white p-3 rounded-lg border border-orange-200">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm text-gray-600">Pending Assignment</p>
                    <p class="text-2xl font-bold text-orange-600">
                      {{ rawData.filter(appt => isAdminAppointment(appt)).length }}
                    </p>
                  </div>
                  <Icon name="material-symbols:pending-actions" class="text-orange-500" size="24" />
                </div>
              </div>
              
              <!-- Assigned Today -->
              <div class="bg-white p-3 rounded-lg border border-green-200">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm text-gray-600">Assigned Today</p>
                    <p class="text-2xl font-bold text-green-600">
                      {{ rawData.filter(appt => !isAdminAppointment(appt) && isAppointmentTodayOrFuture(appt)).length }}
                    </p>
                  </div>
                  <Icon name="material-symbols:check-circle" class="text-green-500" size="24" />
                </div>
              </div>
            </div>
            
            <div class="mt-3 text-sm text-blue-700">
              <p class="flex items-center">
                <Icon name="material-symbols:info" class="mr-1" size="16" />
                Admin appointments are created without a specific practitioner and can be assigned to available doctors/therapists on the appointment date.
              </p>
            </div>
          </rs-card>
        </div>

        <!-- List View - Only show for non-doctors -->
        <div v-if="!userStore.isDoctor && activeTab === 'list'">
          <rs-card class="p-4">
            <!-- Success/Error Messages -->
            <div v-if="successMessage" class="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              {{ successMessage }}
            </div>
            <div v-if="errorMessage" class="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {{ errorMessage }}
            </div>

            <!-- Loading indicator -->
            <div v-if="appointmentsLoading" class="flex justify-center my-8">
              <div class="text-center">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p class="text-gray-500">Refreshing appointments...</p>
              </div>
            </div>

            <!-- No appointments message -->
            <div v-else-if="appointments.length === 0" class="text-center py-8 text-gray-500">
              No appointments found. Click "Add Appointment" to create a new one.
            </div>

            <!-- Appointment Table -->
            <rs-table
              v-else
              :data="appointments"
              :columns="columns"
              :options="{ variant: 'default', striped: true, borderless: true, hover: true }"
              :options-advanced="{ sortable: true, responsive: true, filterable: false }"
              advanced
              class="w-full"
            >
              <!-- Practitioner column with Admin indicator -->
              <template v-slot:practitionerName="row">
                <div class="flex items-center">
                  <span 
                    v-if="isAdminAppointment(getOriginalData(row.value.id))"
                    class="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 mr-2"
                  >
                    Admin
                  </span>
                  <span :class="{ 'text-gray-500 italic': isAdminAppointment(getOriginalData(row.value.id)) }">
                    {{ row.value.practitionerName || 'Admin' }}
                  </span>
                  
                  <!-- Show assignment status for admin appointments -->
                  <div v-if="isAdminAppointment(getOriginalData(row.value.id))" class="ml-2">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800" title="Pending Assignment">
                      Pending
                    </span>
                  </div>
                </div>
              </template>
              
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
                    @click="() => editAppointment(row.value.id)"
                  >
                    <Icon name="material-symbols:edit" size="22" />
                  </span>

                  <!-- View Icon -->
                  <span
                    class="relative group cursor-pointer"
                    @click="() => viewAppointmentDetails(row.value)"
                  >
                    <Icon name="material-symbols:visibility" size="22" />
                  </span>



                  <!-- Delete Icon -->
                  <span
                    class="relative group cursor-pointer"
                    @click="() => confirmDeleteAppointment(row.value.id)"
                  >
                    <Icon name="material-symbols:delete" size="22" class="text-red-500" />
                  </span>
                </div>
              </template>
            </rs-table>
          </rs-card>
        </div>

        <!-- Calendar View - Show for doctors or when calendar tab is active -->
        <div v-if="userStore.isDoctor || activeTab === 'calendar'">
          <rs-card class="p-4">
            <!-- Doctor-specific header -->
            <div v-if="userStore.isDoctor" class="mb-4">
              <h2 class="text-lg font-semibold text-gray-800 mb-2">Your Appointment Calendar</h2>
              <p class="text-sm text-gray-600">View and manage your scheduled appointments. Click on any appointment to view details.</p>
            </div>
            
            <!-- Calendar Controls for non-doctors -->
            <div v-if="!userStore.isDoctor" class="mb-4 flex flex-wrap gap-4 items-center">
              <div class="flex items-center space-x-2">
                <label class="text-sm font-medium text-gray-700">Filter:</label>
                <select 
                  v-model="calendarFilter" 
                  class="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  @change="applyCalendarFilter"
                >
                  <option value="all">All Appointments</option>
                  <option value="admin">Admin Appointments Only</option>
                  <option value="assigned">Assigned Appointments Only</option>
                </select>
              </div>
              
              <div v-if="calendarFilter === 'admin'" class="text-sm text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-200">
                <Icon name="material-symbols:admin-panel-settings" class="mr-1" size="16" />
                Showing Admin Appointments Only
              </div>
            </div>
            
            <!-- Calendar Loading State -->
            <div v-if="appointmentsLoading" class="flex justify-center items-center h-64">
              <div class="text-center">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p class="text-gray-500">Refreshing calendar...</p>
              </div>
            </div>
            
            <FullCalendar v-else :options="calendarOptions" />
            
            <!-- Calendar Legend -->
            <div class="mt-4 p-3 bg-gray-50 rounded-lg border">
              <h4 class="text-sm font-medium text-gray-700 mb-2">Calendar Legend</h4>
              <div class="flex flex-wrap gap-4 text-xs">
                <div class="flex items-center">
                  <div class="w-3 h-3 rounded mr-2" style="background-color: #14452F;"></div>
                  <span>Booked</span>
                </div>
                <div class="flex items-center">
                  <div class="w-3 h-3 rounded mr-2" style="background-color: #1976D2;"></div>
                  <span>Started</span>
                </div>
                <div class="flex items-center">
                  <div class="w-3 h-3 rounded mr-2" style="background-color: #388E3C;"></div>
                  <span>Confirmed Start</span>
                </div>
                <div class="flex items-center">
                  <div class="w-3 h-3 rounded mr-2" style="background-color: #7B1FA2;"></div>
                  <span>Finished</span>
                </div>
                <div class="flex items-center">
                  <div class="w-3 h-3 rounded mr-2" style="background-color: #303F9F;"></div>
                  <span>Completed</span>
                </div>
                <div class="flex items-center">
                  <div class="w-3 h-3 rounded mr-2" style="background-color: #ea580c;"></div>
                  <span class="font-medium">Admin Appointment</span>
                </div>
              </div>
              <div class="mt-2 text-xs text-gray-600">
                <p><strong>Admin Appointments:</strong> Created without a specific practitioner. Can be assigned to available doctors/therapists on the appointment date.</p>
              </div>
            </div>
          </rs-card>
        </div>
      </div>

      <!-- Add Appointment Modal -->
      <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="flex justify-between items-center p-6 border-b border-gray-200">
            <h2 class="text-xl font-bold">Book New Appointment</h2>
            <button @click="showModal = false" class="text-gray-500 hover:text-gray-700">
              <Icon name="material-symbols:close" size="24" />
            </button>
          </div>

          <!-- Scrollable Content -->
          <div class="flex-1 overflow-y-auto p-6">
            <FormKit type="form" :actions="false">
              <FormKit type="date" v-model="appointmentForm.date" name="date" label="Date" validation="required" />
              
              <!-- Patient Selection with Session Check -->
              <div class="relative">
                <label class="block text-sm font-medium text-gray-700 mb-2">Patient Name *</label>
                <div class="relative">
                  <input
                    type="text"
                    v-model="patientSearchText"
                    @focus="showPatientDropdown = true"
                    @blur="setTimeout(() => showPatientDropdown.value = false, 200)"
                    placeholder="Type patient name or IC number..."
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    :class="{ 'border-red-500': !appointmentForm.patient && patientSearchText }"
                  />
                  <div v-if="appointmentForm.patient" class="absolute right-2 top-2">
                    <button
                      type="button"
                      @click="clearPatientSelection"
                      class="text-gray-400 hover:text-gray-600"
                    >
                      <Icon name="material-symbols:close" size="20" />
                    </button>
                  </div>
                  <div v-if="isCheckingSessions" class="absolute right-8 top-2">
                    <Icon name="line-md:loading-twotone-loop" class="text-primary" />
                  </div>
                </div>
                
                <!-- Patient Dropdown -->
                <div v-if="showPatientDropdown && filteredPatients.length > 0" class="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  <div
                    v-for="patient in filteredPatients"
                    :key="patient.value"
                    @click="selectPatient(patient)"
                    class="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <div class="font-medium">{{ patient.label }}</div>
                    <div v-if="patient.ic" class="text-sm text-gray-600">IC: {{ patient.ic }}</div>
                  </div>
                </div>
                
                <!-- Validation Error -->
                <div v-if="!appointmentForm.patient && patientSearchText" class="mt-1 text-sm text-red-600">
                  Please select a patient from the dropdown
                </div>
              </div>
              
              <!-- Patient Session Information -->
              <div v-if="patientSessionInfo" class="p-3 rounded-lg border" :class="patientSessionInfo.can_book_appointment ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'">
                <div class="flex items-center">
                  <Icon 
                    :name="patientSessionInfo.can_book_appointment ? 'material-symbols:check-circle' : 'material-symbols:error'" 
                    :class="patientSessionInfo.can_book_appointment ? 'text-green-600' : 'text-red-600'"
                    size="20"
                    class="mr-2"
                  />
                  <div>
                    <p class="text-sm font-medium" :class="patientSessionInfo.can_book_appointment ? 'text-green-800' : 'text-red-800'">
                      {{ patientSessionInfo.patient_name }}
                    </p>
                    <p class="text-xs" :class="patientSessionInfo.can_book_appointment ? 'text-green-600' : 'text-red-600'">
                      Available Sessions: {{ patientSessionInfo.available_sessions }}
                      <span v-if="!patientSessionInfo.can_book_appointment" class="font-medium"> - Cannot book appointment</span>
                      <span v-else class="text-gray-500"> (1 session will be deducted when booking)</span>
                    </p>
                  </div>
                </div>
              </div>
              
              <FormKit type="select" v-model="appointmentForm.serviceId" name="serviceId" label="Service" :options="serviceOptions" validation="required" :disabled="patientSessionInfo && !patientSessionInfo.can_book_appointment" />
              
              <!-- Therapist/Doctor Selection with Admin Option -->
              <div class="relative">
                <FormKit type="select" v-model="appointmentForm.therapistDoctor" name="therapistDoctor" label="Therapist/Doctor" :options="therapistDoctorOptions" validation="required" :disabled="patientSessionInfo && !patientSessionInfo.can_book_appointment" />
                
                <!-- Show available admin slots info -->
                <div v-if="appointmentForm.therapistDoctor === 'admin' && appointmentForm.date" class="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                  <div class="flex items-center text-blue-700">
                    <Icon name="material-symbols:info" size="16" class="mr-2" />
                    <span>Admin appointments: Maximum 5 slots per day. You can assign to available practitioners on the appointment date.</span>
                  </div>
                  
                  <!-- Show current admin slots count -->
                  <div class="mt-2 p-2 bg-white rounded border border-blue-200">
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-gray-600">Current Admin Slots for {{ appointmentForm.date }}:</span>
                      <span class="font-semibold" :class="adminSlotsCount >= maxAdminSlotsPerDay ? 'text-red-600' : 'text-green-600'">
                        {{ adminSlotsCount }} / {{ maxAdminSlotsPerDay }}
                      </span>
                    </div>
                    
                    <!-- Warning when max slots reached -->
                    <div v-if="adminSlotsCount >= maxAdminSlotsPerDay" class="mt-1 text-xs text-red-600 bg-red-50 p-1 rounded">
                      <Icon name="material-symbols:warning" class="mr-1" size="14" />
                      Maximum admin slots reached for this date. Please select a different date or assign existing admin appointments first.
                    </div>
                    
                    <!-- Success when slots available -->
                    <div v-else class="mt-1 text-xs text-green-600 bg-green-50 p-1 rounded">
                      <Icon name="material-symbols:check-circle" class="mr-1" size="14" />
                      {{ maxAdminSlotsPerDay - adminSlotsCount }} admin slot(s) available for this date.
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="relative">
                <FormKit type="select" v-model="appointmentForm.time" name="time" label="Time Slot" :options="timeSlotOptions" :validation="appointmentForm.therapistDoctor === 'admin' ? '' : 'required'" :disabled="!appointmentForm.date || !appointmentForm.therapistDoctor || isLoadingSlots || (patientSessionInfo && !patientSessionInfo.can_book_appointment) || appointmentForm.therapistDoctor === 'admin'" />
                <div v-if="isLoadingSlots" class="absolute right-2 top-8">
                  <Icon name="line-md:loading-twotone-loop" class="text-primary" />
                </div>
                <div v-if="timeSlotOptions.length === 1 && appointmentForm.date && appointmentForm.therapistDoctor" class="text-red-500 text-sm mt-1">
                  <span v-if="appointmentForm.therapistDoctor === 'admin'">
                    No available admin slots for the selected date (maximum 5 slots per day)
                  </span>
                  <span v-else>
                    No available time slots for the selected date and practitioner
                  </span>
                </div>
                
                <!-- Info message for Admin appointments -->
                <div v-if="appointmentForm.therapistDoctor === 'admin' && appointmentForm.date" class="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                  <div class="flex items-center text-blue-700">
                    <Icon name="material-symbols:info" size="16" class="mr-2" />
                    <span>Time slot will be automatically assigned when you assign this appointment to a practitioner on the appointment date.</span>
                  </div>
                </div>
              </div>
              
              <FormKit type="select" v-model="appointmentForm.status" name="status" label="Status" :options="statusOptions" validation="required" :disabled="patientSessionInfo && !patientSessionInfo.can_book_appointment" />
            </FormKit>
          </div>

          <!-- Fixed Footer with Buttons -->
          <div class="p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <div class="flex justify-end gap-2">
              <rs-button variant="secondary-outline" @click="showModal = false">Cancel</rs-button>
              <rs-button variant="primary" @click="saveAppointment" :disabled="isLoading || (patientSessionInfo && !patientSessionInfo.can_book_appointment)">
                <span v-if="isLoading">Saving...</span>
                <span v-else>Save Appointment</span>
              </rs-button>
            </div>
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
                <p class="text-sm text-gray-500">Session Number</p>
                <p class="font-medium">
                  {{ selectedAppointment.sessionNumber || 1 }}
                  <span class="text-xs text-gray-500">(Sequential appointment number)</span>
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Session Management</p>
                <p class="font-medium text-xs text-gray-600">
                  <span v-if="selectedAppointment.status === 37" class="text-green-600">✓ Session returned to patient</span>
                  <span v-else-if="selectedAppointment.status === 41" class="text-blue-600">✓ Session consumed</span>
                  <span v-else class="text-orange-600">⏳ Session reserved</span>
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

          <div class="mt-6 flex justify-center">
            <rs-button variant="primary" @click="showDetailsModal = false">Close</rs-button>
          </div>
        </div>
      </div>
      
      <!-- Delete Confirmation Modal -->
      <div v-if="showDeleteModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold">Confirm Delete</h2>
            <button @click="showDeleteModal = false" class="text-gray-500 hover:text-gray-700">
              <Icon name="material-symbols:close" size="24" />
            </button>
          </div>
          
          <p class="mb-6">Are you sure you want to delete this appointment? This action cannot be undone.</p>
          
          <div class="flex justify-end gap-2">
            <rs-button variant="secondary-outline" @click="showDeleteModal = false">Cancel</rs-button>
            <rs-button variant="danger" @click="deleteAppointment" :disabled="isLoading">
              <span v-if="isLoading">Deleting...</span>
              <span v-else>Delete Appointment</span>
            </rs-button>
          </div>
        </div>
      </div>

      <!-- Edit Appointment Modal -->
      <div v-if="showEditModal && selectedAppointment" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="flex justify-between items-center p-6 border-b border-gray-200">
            <h2 class="text-xl font-bold">Edit Appointment</h2>
            <button @click="showEditModal = false" class="text-gray-500 hover:text-gray-700">
              <Icon name="material-symbols:close" size="24" />
            </button>
          </div>

          <!-- Scrollable Content -->
          <div class="flex-1 overflow-y-auto p-6">
            <FormKit type="form" :actions="false">
              <FormKit type="date" v-model="appointmentForm.date" name="date" label="Date" validation="required" />
              
              <!-- Patient Selection with Session Check -->
              <div class="relative">
                <label class="block text-sm font-medium text-gray-700 mb-2">Patient Name *</label>
                <div class="relative">
                  <input
                    type="text"
                    v-model="patientSearchText"
                    @focus="showPatientDropdown = true"
                    @blur="setTimeout(() => showPatientDropdown.value = false, 200)"
                    placeholder="Type patient name or IC number..."
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    :class="{ 'border-red-500': !appointmentForm.patient && patientSearchText }"
                  />
                  <div v-if="appointmentForm.patient" class="absolute right-2 top-2">
                    <button
                      type="button"
                      @click="clearPatientSelection"
                      class="text-gray-400 hover:text-gray-600"
                    >
                      <Icon name="material-symbols:close" size="20" />
                    </button>
                  </div>
                  <div v-if="isCheckingSessions" class="absolute right-8 top-2">
                    <Icon name="line-md:loading-twotone-loop" class="text-primary" />
                  </div>
                </div>
                
                <!-- Patient Dropdown -->
                <div v-if="showPatientDropdown && filteredPatients.length > 0" class="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  <div
                    v-for="patient in filteredPatients"
                    :key="patient.value"
                    @click="selectPatient(patient)"
                    class="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <div class="font-medium">{{ patient.label }}</div>
                    <div v-if="patient.ic" class="text-sm text-gray-600">IC: {{ patient.ic }}</div>
                  </div>
                </div>
                
                <!-- Validation Error -->
                <div v-if="!appointmentForm.patient && patientSearchText" class="mt-1 text-sm text-red-600">
                  Please select a patient from the dropdown
                </div>
              </div>
              
              <!-- Patient Session Information -->
              <div v-if="patientSessionInfo" class="p-3 rounded-lg border" :class="patientSessionInfo.can_book_appointment ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'">
                <div class="flex items-center">
                  <Icon 
                    :name="patientSessionInfo.can_book_appointment ? 'material-symbols:check-circle' : 'material-symbols:error'" 
                    :class="patientSessionInfo.can_book_appointment ? 'text-green-600' : 'text-red-600'"
                    size="20"
                    class="mr-2"
                  />
                  <div>
                    <p class="text-sm font-medium" :class="patientSessionInfo.can_book_appointment ? 'text-green-800' : 'text-red-800'">
                      {{ patientSessionInfo.patient_name }}
                    </p>
                    <p class="text-xs" :class="patientSessionInfo.can_book_appointment ? 'text-green-600' : 'text-red-600'">
                      Available Sessions: {{ patientSessionInfo.available_sessions }}
                      <span v-if="!patientSessionInfo.can_book_appointment" class="font-medium"> - Cannot book appointment</span>
                      <span v-else class="text-gray-500"> (1 session will be deducted when booking)</span>
                    </p>
                  </div>
                </div>
              </div>
              
              <FormKit type="select" v-model="appointmentForm.serviceId" name="serviceId" label="Service" :options="serviceOptions" validation="required" :disabled="patientSessionInfo && !patientSessionInfo.can_book_appointment" />
              
              <!-- Therapist/Doctor Selection with Admin Option -->
              <div class="relative">
                <FormKit type="select" v-model="appointmentForm.therapistDoctor" name="therapistDoctor" label="Therapist/Doctor" :options="therapistDoctorOptions" validation="required" :disabled="patientSessionInfo && !patientSessionInfo.can_book_appointment" />
                
                <!-- Show available admin slots info -->
                <div v-if="appointmentForm.therapistDoctor === 'admin' && appointmentForm.date" class="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                  <div class="flex items-center text-blue-700">
                    <Icon name="material-symbols:info" size="16" class="mr-2" />
                    <span>Admin appointments: Maximum 5 slots per day. You can assign to available practitioners on the appointment date.</span>
                  </div>
                  
                  <!-- Show current admin slots count -->
                  <div class="mt-2 p-2 bg-white rounded border border-blue-200">
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-gray-600">Current Admin Slots for {{ appointmentForm.date }}:</span>
                      <span class="font-semibold" :class="adminSlotsCount >= maxAdminSlotsPerDay ? 'text-red-600' : 'text-green-600'">
                        {{ adminSlotsCount }} / {{ maxAdminSlotsPerDay }}
                      </span>
                    </div>
                    
                    <!-- Warning when max slots reached -->
                    <div v-if="adminSlotsCount >= maxAdminSlotsPerDay" class="mt-1 text-xs text-red-600 bg-red-50 p-1 rounded">
                      <Icon name="material-symbols:warning" class="mr-1" size="14" />
                      Maximum admin slots reached for this date. Please select a different date or assign existing admin appointments first.
                    </div>
                    
                    <!-- Success when slots available -->
                    <div v-else class="mt-1 text-xs text-green-600 bg-green-50 p-1 rounded">
                      <Icon name="material-symbols:check-circle" class="mr-1" size="14" />
                      {{ maxAdminSlotsPerDay - adminSlotsCount }} admin slot(s) available for this date.
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="relative">
                <FormKit type="select" v-model="appointmentForm.time" name="time" label="Time Slot" :options="timeSlotOptions" :validation="appointmentForm.therapistDoctor === 'admin' ? '' : 'required'" :disabled="!appointmentForm.date || !appointmentForm.therapistDoctor || isLoadingSlots || (patientSessionInfo && !patientSessionInfo.can_book_appointment) || appointmentForm.therapistDoctor === 'admin'" />
                <div v-if="isLoadingSlots" class="absolute right-2 top-8">
                  <Icon name="line-md:loading-twotone-loop" class="text-primary" />
                </div>
                <div v-if="timeSlotOptions.length === 1 && appointmentForm.date && appointmentForm.therapistDoctor" class="text-red-500 text-sm mt-1">
                  <span v-if="appointmentForm.therapistDoctor === 'admin'">
                    No available admin slots for the selected date (maximum 5 slots per day)
                  </span>
                  <span v-else>
                    No available time slots for the selected date and practitioner
                  </span>
                </div>
                
                <!-- Info message for Admin appointments -->
                <div v-if="appointmentForm.therapistDoctor === 'admin' && appointmentForm.date" class="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                  <div class="flex items-center text-blue-700">
                    <Icon name="material-symbols:info" size="16" class="mr-2" />
                    <span>Time slot will be automatically assigned when you assign this appointment to a practitioner on the appointment date.</span>
                  </div>
                </div>
              </div>
              
              <FormKit type="select" v-model="appointmentForm.status" name="status" label="Status" :options="statusOptions" validation="required" :disabled="patientSessionInfo && !patientSessionInfo.can_book_appointment" />
            </FormKit>
          </div>

          <!-- Fixed Footer with Buttons -->
          <div class="p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <div class="flex justify-end gap-2">
              <rs-button variant="secondary-outline" @click="showEditModal = false">Cancel</rs-button>
              <rs-button variant="primary" @click="saveEditedAppointment" :disabled="isLoading || (patientSessionInfo && !patientSessionInfo.can_book_appointment)">
                <span v-if="isLoading">Saving...</span>
                <span v-else>Save Appointment</span>
              </rs-button>
            </div>
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
            <p class="text-xs text-red-500 mt-1">Note: Comment field can take up to 255 characters maximum.</p>
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



      <!-- Delete Confirmation Modal -->
      <div v-if="showDeleteModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold">Confirm Delete</h2>
            <button @click="showDeleteModal = false" class="text-gray-500 hover:text-gray-700">
              <Icon name="material-symbols:close" size="24" />
            </button>
          </div>
          
          <p class="mb-6">Are you sure you want to delete this appointment? This action cannot be undone.</p>
          
          <div class="flex justify-end gap-2">
            <rs-button variant="secondary-outline" @click="showDeleteModal = false">Cancel</rs-button>
            <rs-button variant="danger" @click="deleteAppointment" :disabled="isLoading">
              <span v-if="isLoading">Deleting...</span>
              <span v-else>Delete Appointment</span>
            </rs-button>
          </div>
        </div>
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

<style>
.fc {
  background-color: #fff; /* calendar background white */
}

.fc .fc-event {
  cursor: pointer;
}
</style>
