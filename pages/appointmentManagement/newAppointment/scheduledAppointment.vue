<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useUserStore } from '@/stores/user';
import { useFetch, useLazyFetch } from '#app';
import Loading from '@/components/Loading.vue';
import {
  buildAppointmentPdfFilename,
  renderAppointmentPdf,
} from '@/utils/appointmentDocument';
import {
  APPOINTMENT_STATUS_CANCELLED,
  APPOINTMENT_STATUS_FORM_OPTIONS,
  APPOINTMENT_STATUS_LIST,
  APPOINTMENT_STATUS_MAP,
  getAppointmentStatus,
} from '@/utils/appointmentStatus';
import { formatInvoiceNumber, getBillingStateMeta } from '@/utils/billingState';
import { buildAppointmentEventContent } from '@/utils/calendarEvent';

// FullCalendar is browser-only. Use the client plugin (same as pages/ui/component/calendar.vue)
// instead of importing it here — top-level imports break SSR on hard reload.
definePageMeta({
  ssr: false,
  title: "Appointments Management",
});

const { $FullCalendar } = useNuxtApp();
const FullCalendar = $FullCalendar;
const userStore = useUserStore();

const calendarOptions = ref({
  ...($FullCalendar?.options || {}),
  initialView: 'dayGridMonth',
  headerToolbar: {
    left: "prev,next title",
    right: "dayGridMonth,timeGridWeek,listWeek",
  },
  // Timed events are drawn as plain text with a dot by default, which loses the status
  // colour. Draw them as coloured blocks instead.
  eventDisplay: 'block',
  // A busy day shows at most 3 events in the month grid; the rest open in a "+N more" popover.
  views: {
    dayGridMonth: {
      dayMaxEvents: 3,
      moreLinkClick: 'popover',
      moreLinkContent: (args) => `+${args.num} more`,
    },
  },
  events: [],
  eventClick: handleEventClick,
  eventClassNames: (arg) =>
    Number(arg.event.extendedProps.status) === APPOINTMENT_STATUS_CANCELLED ? ['fc-event-cancelled'] : [],
  // Billing labels are only shown to administrators.
  eventContent: (arg) =>
    buildAppointmentEventContent(arg, {
      showBilling: userStore.isAdmin,
      timeRangeText: extractTimeOnly,
    }),
});

// Cancelled appointments are hidden unless the "Show cancelled" toggle is on.
const showCancelled = ref(false);

// One place builds calendar events, so every filter shows the same status colour and details.
const buildCalendarEvent = (appt) => {
  const color = getStatusColor(appt.status);
  const isAdmin = isAdminAppointment(appt);
  return {
    id: appt.id,
    title: appt.patientName,
    start: appt.originalDate || appt.date,
    end: appt.originalDate || appt.date,
    allDay: false,
    backgroundColor: color,
    borderColor: color,
    textColor: '#fff',
    extendedProps: {
      patient_name: appt.patientName,
      practitioner_name: isAdmin ? 'Admin' : appt.practitionerName,
      service_name: appt.serviceName,
      time_slot: appt.timeSlot,
      start_time: appt.startTime,
      end_time: appt.endTime,
      status: appt.status,
      patient_id: appt.patientId,
      practitioner_id: isAdmin ? null : appt.practitionerId,
      service_id: appt.serviceId,
      slot_ID: appt.slotId,
      parent_comment: appt.parentComment,
      therapist_doctor_comment: appt.therapistDoctorComment,
      parent_rate: appt.parentRate,
      session_number: appt.sessionNumber,
      is_admin_appointment: appt.isAdminAppointment,
      needs_billing: appt.needsBilling,
      billing_state: appt.billingState,
      invoice_id: appt.invoiceId,
    },
  };
};

const syncCalendarEventsFromRawData = () => {
  const visibleAppointments = rawData.value.filter((appt) => {
    if (!showCancelled.value && Number(appt.status) === APPOINTMENT_STATUS_CANCELLED) return false;
    if (calendarFilter.value === 'admin') return isAdminAppointment(appt);
    if (calendarFilter.value === 'assigned') return !isAdminAppointment(appt);
    return true;
  });

  calendarOptions.value.events = visibleAppointments.map(buildCalendarEvent);

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
      startTime: extendedProps.start_time || '',
      endTime: extendedProps.end_time || '',
      status: extendedProps.status || 36,
      patientId: extendedProps.patient_id,
      practitionerId: extendedProps.practitioner_id,
      serviceId: extendedProps.service_id,
      slotId: extendedProps.slot_ID,
      parentComment: extendedProps.parent_comment,
      therapistDoctorComment: extendedProps.therapist_doctor_comment,
      parentRate: extendedProps.parent_rate || 0,
      sessionNumber: extendedProps.session_number ?? null,
      needsBilling: !!extendedProps.needs_billing,
      billingState: extendedProps.billing_state ?? null,
      invoiceId: extendedProps.invoice_id ?? null,
      rawExtendedProps: extendedProps
    };
    
    // Add this appointment to the raw data for future reference
    rawData.value.push(formattedAppointment);
    
    // Set as selected appointment and show details modal
    selectedAppointment.value = formattedAppointment;
    showDetailsModal.value = true;
  }
}

// Calendar colour for a status (shared status table)
function getStatusColor(status) {
  return getAppointmentStatus(status).color;
}

onMounted(() => {
  // Calendar events load when user opens the calendar tab (see activeTab watch).
  setTimeout(() => {
    isPageLoading.value = false;
  }, 10000);
});

const currentUserId = userStore.userID || 1; // fallback to 1 if not set

// Loading states
const isLoading = ref(false);
const isLoadingSlots = ref(false); // Separate loading state for time slots
const isPageLoading = ref(true); // Page loading state for initial load
const errorMessage = ref("");
const successMessage = ref("");

// Appointments data
const rawData = ref([]);

// Modal state
const showModal = ref(false);
const showDetailsModal = ref(false);
const printingAppointmentId = ref(null);
const showEditModal = ref(false);
const showCommentModal = ref(false);
const showRatingModal = ref(false);
const isEditing = ref(false);

// Patient search state
const patientSearchText = ref('');
const showPatientDropdown = ref(false);
const filteredPatients = ref([]);
const blurTimeout = ref(null); // Add this for better blur handling
const isSelectingPatient = ref(false); // Flag to prevent blur conflicts during selection

// Form data
const appointmentForm = ref({
  date: new Date().toISOString().slice(0, 10),
  start_time: "",
  duration_type: "1hour",
  custom_end_time: "",
  patient: "",
  serviceId: "",
  therapistDoctor: "",
  status: 36
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
const startTimeOptions = ref([{ label: "--- Please select ---", value: "" }]);
const customEndOptions = ref([{ label: "--- Please select ---", value: "" }]);
const durationOptions = [
  { label: "30 minutes", value: "30min" },
  { label: "1 hour", value: "1hour" },
  { label: "Custom end time", value: "custom" },
];

function formatTime12h(time24) {
  if (!time24) return "";
  const [hourPart, minutePart] = time24.split(":").map(Number);
  const period = hourPart >= 12 ? "PM" : "AM";
  const hour12 = hourPart % 12 || 12;
  return `${hour12}:${minutePart.toString().padStart(2, "0")} ${period}`;
}

function getCustomEndOptions(startTime) {
  if (!startTime) return [];
  const [startHour, startMinute] = startTime.split(":").map(Number);
  let startMinutes = startHour * 60 + startMinute;
  const options = [];

  for (startMinutes += 30; startMinutes <= 18 * 60; startMinutes += 30) {
    const hours = Math.floor(startMinutes / 60);
    const minutes = startMinutes % 60;
    const value = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    options.push({ label: formatTime12h(value), value });
  }

  return options;
}

function computeEndTimeLocal(startTime, durationType, customEndTime) {
  if (!startTime) return "";
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const startMinutes = startHour * 60 + startMinute;

  if (durationType === "30min") {
    return getCustomEndOptions(startTime)[0]?.value || "";
  }

  if (durationType === "1hour") {
    const endMinutes = startMinutes + 60;
    const hours = Math.floor(endMinutes / 60);
    const minutes = endMinutes % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }

  return customEndTime || "";
}

function inferDurationType(startTime, endTime) {
  if (!startTime || !endTime) return "1hour";
  const toMinutes = (time) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };
  const diff = toMinutes(endTime) - toMinutes(startTime);
  if (diff === 30) return "30min";
  if (diff === 60) return "1hour";
  return "custom";
}

const computedEndTime = computed(() => {
  return computeEndTimeLocal(
    appointmentForm.value.start_time,
    appointmentForm.value.duration_type,
    appointmentForm.value.custom_end_time,
  );
});

function buildTimePayload() {
  return {
    start_time: appointmentForm.value.start_time,
    duration_type: appointmentForm.value.duration_type,
    custom_end_time:
      appointmentForm.value.duration_type === "custom"
        ? appointmentForm.value.custom_end_time
        : undefined,
  };
}

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

// Status mapping (Booked / Cancelled / Completed; shared with the rest of the app)
const statusMapping = Object.fromEntries(
  Object.entries(APPOINTMENT_STATUS_MAP).map(([code, status]) => [code, { label: status.label, class: status.badgeClass }]),
);

// Selected appointment for viewing/editing
const selectedAppointment = ref(null);

// Session checks apply only when booking NEW appointments or RE-ACTIVATING
// a cancelled one. Editing an existing booked appointment (status !== 37)
// already holds a session — status, practitioner, and time can be changed
// even when available_session is 0.
const createBlocksDueToSessions = computed(
  () => patientSessionInfo.value && !patientSessionInfo.value.can_book_appointment,
);

const editRequiresSessionDeduction = computed(() => {
  if (!selectedAppointment.value) return false;
  const originalStatus = Number(selectedAppointment.value.status);
  const newStatus = Number(appointmentForm.value.status);
  return originalStatus === 37 && newStatus !== 37;
});

const editSessionAlreadyReserved = computed(() => {
  if (!selectedAppointment.value) return false;
  return Number(selectedAppointment.value.status) !== 37;
});

const editBlocksDueToSessions = computed(
  () => editRequiresSessionDeduction.value && createBlocksDueToSessions.value,
);

const isCancellingEdit = computed(() => parseInt(appointmentForm.value.status, 10) === 37);

// Session banner: green = prepaid session available, amber = no sessions left (the booking
// will be marked unbilled), red = the admin-set limit of unbilled sessions is reached.
const BANNER_TONES = {
  green: { box: 'bg-green-50 border-green-200', icon: 'text-green-600', title: 'text-green-800', text: 'text-green-700' },
  amber: { box: 'bg-amber-50 border-amber-300', icon: 'text-amber-600', title: 'text-amber-900', text: 'text-amber-800' },
  red: { box: 'bg-red-50 border-red-200', icon: 'text-red-600', title: 'text-red-800', text: 'text-red-700' },
};
const sessionBannerTone = computed(() => {
  const info = patientSessionInfo.value;
  if (!info) return 'green';
  if (!info.can_book_appointment) return 'red';
  return info.will_be_unbilled ? 'amber' : 'green';
});
const sessionBanner = computed(() => BANNER_TONES[sessionBannerTone.value]);
const sessionBannerIcon = computed(() => {
  if (sessionBannerTone.value === 'green') return 'material-symbols:check-circle';
  return sessionBannerTone.value === 'amber' ? 'material-symbols:info' : 'material-symbols:error';
});
function sessionCapText(info) {
  if (info && info.max_unbilled === 0) {
    return `has no available sessions (${info.available_sessions}). Please purchase more sessions first.`;
  }
  return `has reached the limit of ${info?.max_unbilled ?? 0} unbilled session(s). Bill the unbilled sessions first.`;
}

// Comment form
const commentForm = ref({
  comment: "",
  userType: "" // "parent" or "practitioner"
});

// Status options for dropdown
const statusOptions = ref(APPOINTMENT_STATUS_FORM_OPTIONS);

const listFilter = ref('all');

function buildTableRows(rawAppointments) {
  return rawAppointments.map((appt, index) => {
    const visibleData = {
      no: index + 1,
      patientName: appt.patientName,
      practitionerName: appt.practitionerName,
      serviceName: appt.serviceName,
      date: appt.date,
      timeSlot: appt.timeSlot,
      status: appt.status,
      action: 'edit',
    };

    Object.defineProperty(visibleData, 'id', {
      value: appt.id,
      enumerable: false,
    });

    return visibleData;
  });
}

function getAppointmentDateTime(appt) {
  if (!appt) return null;

  if (appt.originalDate) {
    const fromOriginal = new Date(appt.originalDate);
    if (!Number.isNaN(fromOriginal.getTime())) {
      return fromOriginal;
    }
  }

  if (appt.startTime && appt.originalDate) {
    const datePart = String(appt.originalDate).split('T')[0];
    const fromParts = new Date(`${datePart}T${appt.startTime}:00`);
    if (!Number.isNaN(fromParts.getTime())) {
      return fromParts;
    }
  }

  const parsedDate = new Date(appt.date);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function isUpcomingAppointment(appt) {
  if (!appt || Number(appt.status) === 37) return false;

  const appointmentDateTime = getAppointmentDateTime(appt);
  if (!appointmentDateTime) return false;

  return appointmentDateTime >= new Date();
}

const filteredListAppointments = computed(() => {
  let source = rawData.value;

  if (listFilter.value === 'next') {
    source = [...rawData.value]
      .filter(isUpcomingAppointment)
      .sort((a, b) => {
        const dateA = getAppointmentDateTime(a)?.getTime() ?? 0;
        const dateB = getAppointmentDateTime(b)?.getTime() ?? 0;
        return dateA - dateB;
      });
  }

  return buildTableRows(source);
});

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
          startTime: appt.extendedProps.start_time || '',
          endTime: appt.extendedProps.end_time || '',
          status: appt.extendedProps.status || 36,
          patientId: appt.extendedProps.patient_id,
          practitionerId: appt.extendedProps.practitioner_id,
          serviceId: appt.extendedProps.service_id,
          slotId: appt.extendedProps.slot_ID,
          parentComment: appt.extendedProps.parent_comment,
          therapistDoctorComment: appt.extendedProps.therapist_doctor_comment,
          parentRate: appt.extendedProps.parent_rate || 0,
          sessionNumber: appt.extendedProps.session_number ?? null,
          isAdminAppointment: appt.extendedProps.is_admin_appointment || false,
          needsBilling: !!appt.extendedProps.needs_billing,
          billingState: appt.extendedProps.billing_state ?? null,
          invoiceId: appt.extendedProps.invoice_id ?? null,
          rawExtendedProps: appt.extendedProps
        };
      });
      
      rawData.value = rawAppointments;
      
      return buildTableRows(rawAppointments);
    }
    return [];
  }
});

// Refresh list data; sync calendar from list when that tab is active.
const refreshAppointments = async () => {
  await _refreshAppointments();
  if (activeTab.value === 'calendar' || userStore.isDoctor) {
    applyCalendarFilter();
  }
};

watch(
  () => appointmentsData.value,
  (newData) => {
    if (newData && (activeTab.value === 'calendar' || userStore.isDoctor)) {
      applyCalendarFilter();
    }
  },
);

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

function getSlotFetchParams(date, practitionerId, { forEndTimes = false } = {}) {
  const params = {
    date,
    duration_type: appointmentForm.value.duration_type,
  };

  if (forEndTimes && appointmentForm.value.start_time) {
    params.start_time = appointmentForm.value.start_time;
  }

  if (practitionerId === "admin") {
    params.is_admin = true;
  } else {
    params.practitioner_id = practitionerId;
  }

  if (isEditing.value && selectedAppointment.value?.id) {
    params.exclude_appointment_id = selectedAppointment.value.id;
  }

  return params;
}

function applyAvailableSlots(slots, targetRef, emptyMessage) {
  targetRef.value = [
    { label: "--- Please select ---", value: "" },
    ...slots
      .filter((slot) => slot.isAvailable)
      .map((slot) => ({
        label: slot.label || formatTime12h(slot.value),
        value: slot.value,
      })),
  ];

  if (targetRef.value.length === 1 && emptyMessage) {
    errorMessage.value = emptyMessage;
  }
}

// Fetch available start times based on date + practitioner
const fetchTimeSlots = async (date, practitionerId) => {
  if (!date || !practitionerId) {
    startTimeOptions.value = [{ label: "--- Please select ---", value: "" }];
    customEndOptions.value = [{ label: "--- Please select ---", value: "" }];
    return;
  }

  isLoadingSlots.value = true;

  try {
    const { data, error } = await useFetch("/api/appointments/slots", {
      method: "GET",
      params: getSlotFetchParams(date, practitionerId),
    });

    if (error.value) {
      console.error("Error fetching time slots:", error.value);
      startTimeOptions.value = [{ label: "--- Please select ---", value: "" }];
      return;
    }

    if (data.value && data.value.success) {
      const emptyMessage =
        practitionerId === "admin"
          ? "No available start times for the selected date"
          : "No available start times for the selected date and practitioner";

      applyAvailableSlots(data.value.data || [], startTimeOptions, emptyMessage);

      if (
        appointmentForm.value.start_time &&
        !startTimeOptions.value.some(
          (option) => option.value === appointmentForm.value.start_time,
        )
      ) {
        appointmentForm.value.start_time = "";
        appointmentForm.value.custom_end_time = "";
        customEndOptions.value = [{ label: "--- Please select ---", value: "" }];
      } else if (
        appointmentForm.value.duration_type === "custom" &&
        appointmentForm.value.start_time
      ) {
        await fetchCustomEndTimes(date, practitionerId, { manageLoading: false });
      } else {
        customEndOptions.value = [{ label: "--- Please select ---", value: "" }];
      }
    } else {
      errorMessage.value = data.value?.message || "Failed to load start times";
      startTimeOptions.value = [{ label: "--- Please select ---", value: "" }];
    }
  } catch (err) {
    console.error("Error fetching time slots:", err);
    startTimeOptions.value = [{ label: "--- Please select ---", value: "" }];
  } finally {
    isLoadingSlots.value = false;
  }
};

const fetchCustomEndTimes = async (
  date,
  practitionerId,
  { manageLoading = true } = {},
) => {
  if (
    !date ||
    !practitionerId ||
    appointmentForm.value.duration_type !== "custom" ||
    !appointmentForm.value.start_time
  ) {
    customEndOptions.value = [{ label: "--- Please select ---", value: "" }];
    return;
  }

  if (manageLoading) {
    isLoadingSlots.value = true;
  }

  try {
    const { data, error } = await useFetch("/api/appointments/slots", {
      method: "GET",
      params: getSlotFetchParams(date, practitionerId, { forEndTimes: true }),
    });

    if (error.value) {
      console.error("Error fetching custom end times:", error.value);
      customEndOptions.value = [{ label: "--- Please select ---", value: "" }];
      return;
    }

    if (data.value && data.value.success && data.value.slotType === "end") {
      const emptyMessage =
        practitionerId === "admin"
          ? "No available end times for the selected start time"
          : "No available end times for the selected start time and practitioner";

      applyAvailableSlots(data.value.data || [], customEndOptions, emptyMessage);

      if (
        appointmentForm.value.custom_end_time &&
        !customEndOptions.value.some(
          (option) => option.value === appointmentForm.value.custom_end_time,
        )
      ) {
        appointmentForm.value.custom_end_time = "";
      }
    } else {
      errorMessage.value = data.value?.message || "Failed to load end times";
      customEndOptions.value = [{ label: "--- Please select ---", value: "" }];
    }
  } catch (err) {
    console.error("Error fetching custom end times:", err);
    customEndOptions.value = [{ label: "--- Please select ---", value: "" }];
  } finally {
    if (manageLoading) {
      isLoadingSlots.value = false;
    }
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
  } else {
    console.log("Missing date or practitioner, resetting time slots");
    // Reset time slots if either date or practitioner is not selected
    startTimeOptions.value = [{ label: "--- Please select ---", value: "" }];
    appointmentForm.value.start_time = "";
  }
});

watch(
  () => appointmentForm.value.duration_type,
  (newDuration) => {
    if (!appointmentForm.value.date || !appointmentForm.value.therapistDoctor) {
      return;
    }

    if (newDuration !== "custom") {
      appointmentForm.value.custom_end_time = "";
      customEndOptions.value = [{ label: "--- Please select ---", value: "" }];
    }

    fetchTimeSlots(
      appointmentForm.value.date,
      appointmentForm.value.therapistDoctor,
    );
  },
);

watch(
  () => appointmentForm.value.start_time,
  (newStartTime, oldStartTime) => {
    if (newStartTime === oldStartTime) return;

    appointmentForm.value.custom_end_time = "";
    customEndOptions.value = [{ label: "--- Please select ---", value: "" }];

    if (
      appointmentForm.value.duration_type === "custom" &&
      newStartTime &&
      appointmentForm.value.date &&
      appointmentForm.value.therapistDoctor
    ) {
      fetchCustomEndTimes(
        appointmentForm.value.date,
        appointmentForm.value.therapistDoctor,
      );
    }
  },
);

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
  if (newText && !appointmentForm.value.patient) {
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
    
    const isAdmin = appointmentForm.value.therapistDoctor === 'admin';

    // Validate
    if (!appointmentForm.value.date || 
        !appointmentForm.value.patient || 
        !appointmentForm.value.therapistDoctor || 
        !appointmentForm.value.serviceId ||
        !appointmentForm.value.duration_type ||
        (!isAdmin && !appointmentForm.value.start_time)) {
      errorMessage.value = "Please fill in all required fields";
      console.log("Validation failed - missing required fields");
      return;
    }

    if (appointmentForm.value.duration_type === 'custom' && !appointmentForm.value.custom_end_time) {
      errorMessage.value = "Please select a custom end time";
      return;
    }
    
    if (!isAdmin && !appointmentForm.value.start_time) {
      errorMessage.value = "Please select a start time";
      console.log("Validation failed - missing start time for non-admin appointment");
      return;
    }

    // Check if patient has available sessions
    if (createBlocksDueToSessions.value) {
      errorMessage.value = `Cannot create appointment. ${patientSessionInfo.value.patient_name}: ${sessionCapText(patientSessionInfo.value)}`;
      console.log("Validation failed - patient reached the unbilled session limit");
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
      status: 36,
      is_admin_appointment: appointmentForm.value.therapistDoctor === 'admin',
      ...buildTimePayload(),
    };

    console.log("Sending appointment data to API:", appointmentData);

    const { data } = await useFetch('/api/appointments/create', {
      method: 'POST',
      body: appointmentData
    });

    console.log("API response:", data.value);

    if (data.value && data.value.success) {
      // Booked without a prepaid session: it is marked unbilled until an invoice covers it.
      const sessionNote = data.value.data?.needs_billing
        ? "The patient had no sessions left, so this appointment is marked unbilled. Create an invoice to collect payment."
        : "One session has been deducted from the patient's available sessions.";
      if (appointmentForm.value.therapistDoctor === 'admin') {
        successMessage.value = `Admin appointment created successfully! ${sessionNote} You can assign this to a doctor/therapist on the appointment date.`;
        console.log("Admin appointment created successfully");
      } else {
        successMessage.value = `Appointment created successfully! ${sessionNote}`;
        console.log("Regular appointment created successfully");
      }
      
             // Reset form
       appointmentForm.value = {
         date: new Date().toISOString().slice(0, 10),
         start_time: "",
         duration_type: "1hour",
         custom_end_time: "",
         patient: "",
         serviceId: "",
         therapistDoctor: "",
         status: 36
       };
       startTimeOptions.value = [{ label: "--- Please select ---", value: "" }];
       
       // Reset patient session info
       patientSessionInfo.value = null;
       
       // Reset patient search
       if (blurTimeout.value) {
         clearTimeout(blurTimeout.value);
         blurTimeout.value = null;
       }
       isSelectingPatient.value = false;
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
    start_time: "",
    duration_type: "1hour",
    custom_end_time: "",
    patient: "",
    serviceId: "",
    therapistDoctor: "",
    status: "36"
  };
  
  console.log("Form reset to:", appointmentForm.value);
  
  // Reset patient session info
  patientSessionInfo.value = null;
  
  // Reset patient search
  if (blurTimeout.value) {
    clearTimeout(blurTimeout.value);
    blurTimeout.value = null;
  }
  isSelectingPatient.value = false;
  patientSearchText.value = '';
  showPatientDropdown.value = false;
  filteredPatients.value = [];
  
  startTimeOptions.value = [{ label: "--- Please select ---", value: "" }];
  customEndOptions.value = [{ label: "--- Please select ---", value: "" }];
  
  console.log("Reset patientSessionInfo");
  
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
      if (newStatus === 41) promptToBill(appointmentId);
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

// Billing ("book first, bill later") is for administrators only.
const canSeeBilling = computed(() => userStore.isAdmin);

// Open the invoice form with this appointment ready to be billed.
function billSession(appointment) {
  if (!appointment) return;
  router.push({
    path: '/payment/create',
    query: { patientId: String(appointment.patientId), appointmentIds: String(appointment.id) },
  });
}

// When an unbilled appointment is completed, offer to bill it right away.
function promptToBill(appointmentId) {
  if (!canSeeBilling.value) return;
  const appointment = getOriginalData(appointmentId);
  if (appointment && appointment.billingState === 'unbilled' && Number(appointment.status) === 41) {
    if (confirm("This session hasn't been billed yet. Create an invoice now?")) {
      billSession(appointment);
    }
  }
}

// Extra warning before cancelling an appointment that an invoice already bills.
function billedCancelWarning(appointment) {
  return appointment && appointment.invoiceId
    ? `\n\nThis appointment is billed on ${formatInvoiceNumber(appointment.invoiceId)}. The invoice keeps its amount; the patient will have one spare session once it is paid.`
    : '';
}

// Handle status change based on action
const handleStatusChange = (appointment, newStatus) => {
  const statusLabel = getAppointmentStatus(newStatus).label;

  // Special confirmation for cancelled status
  if (newStatus === 37) {
    if (confirm(`Are you sure you want to mark this appointment as "Cancelled"? This will add back one session to the patient's available sessions.${billedCancelWarning(appointment)}`)) {
      updateAppointmentStatus(appointment.id, newStatus);
    }
  } else if (newStatus === 41) {
    if (confirm(`Are you sure you want to mark this appointment as "Completed"?`)) {
      updateAppointmentStatus(appointment.id, newStatus);
    }
  } else {
    // Confirm before updating for other statuses
    if (confirm(`Are you sure you want to mark this appointment as "${statusLabel}"?`)) {
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

const downloadAppointmentPdf = async (appointment) => {
  if (!appointment || printingAppointmentId.value) return;

  printingAppointmentId.value = appointment.id;
  try {
    const { default: jsPDF } = await import('jspdf');
    const pdf = await renderAppointmentPdf(jsPDF, appointment, statusMapping);
    pdf.save(buildAppointmentPdfFilename(appointment));
  } catch (error) {
    console.error('Failed to generate appointment PDF:', error);
    alert('Failed to generate appointment PDF. Please try again.');
  } finally {
    printingAppointmentId.value = null;
  }
};

const downloadSelectedAppointmentPdf = async () => {
  if (!selectedAppointment.value) return;
  await downloadAppointmentPdf(selectedAppointment.value);
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
    const startTime = appointment.startTime || appointment.rawExtendedProps?.start_time || "";
    const endTime = appointment.endTime || appointment.rawExtendedProps?.end_time || "";
    const durationType = inferDurationType(startTime, endTime);

    appointmentForm.value = {
      date: originalDate,
      patient: appointment.patientId?.toString() || "",
      serviceId: appointment.serviceId?.toString() || "",
      therapistDoctor: isAdminAppointment(appointment) ? "admin" : (appointment.practitionerId?.toString() || ""),
      start_time: startTime,
      duration_type: durationType,
      custom_end_time: durationType === "custom" ? endTime : "",
      status: String(getAppointmentStatus(appointment.status).value ?? 36)
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

// "Edit" button inside the calendar's Appointment Details pop-up
function openEditFromDetails() {
  const id = selectedAppointment.value?.id;
  showDetailsModal.value = false;
  if (id !== undefined && id !== null) editAppointment(id);
}

// Deep link: .../scheduledAppointment?editId=<appointment id> opens that
// appointment's edit form once the appointments and form options have loaded.
const route = useRoute();
const router = useRouter();
const pendingEditId = ref(route.query.editId ? Number(route.query.editId) : null);

watch(
  [appointmentsData, optionsData],
  ([appointments, options]) => {
    if (!pendingEditId.value || !appointments || !options) return;
    const id = pendingEditId.value;
    pendingEditId.value = null;

    if (getOriginalData(id)) {
      editAppointment(id);
    } else {
      errorMessage.value = "That appointment could not be found. It may have been deleted.";
    }

    const { editId, ...otherQuery } = route.query;
    router.replace({ query: otherQuery });
  },
  { immediate: true },
);

// Save edited appointment
const saveEditedAppointment = async () => {
  try {
    const newStatus = parseInt(appointmentForm.value.status, 10);

    // Cancelling only needs a status update — no time or practitioner required
    if (newStatus === 37) {
      if (selectedAppointment.value?.status === 37) {
        errorMessage.value = "This appointment is already cancelled";
        return;
      }

      if (!confirm(`Are you sure you want to cancel this appointment? One session will be added back to the patient's available sessions.${billedCancelWarning(selectedAppointment.value)}`)) {
        return;
      }

      isLoading.value = true;
      errorMessage.value = "";
      successMessage.value = "";

      const { data } = await useFetch('/api/appointments/update', {
        method: 'PUT',
        body: {
          appointment_id: selectedAppointment.value.id,
          status: 37
        }
      });

      if (data.value && data.value.success) {
        successMessage.value = "Appointment cancelled successfully! One session has been added back to the patient's available sessions.";
        showEditModal.value = false;
        isEditing.value = false;
        await refreshAppointments();
      } else {
        errorMessage.value = data.value?.message || "Failed to cancel appointment";
      }

      return;
    }

    const isAdmin = appointmentForm.value.therapistDoctor === 'admin';

    // Validate non-cancellation edits
    if (!appointmentForm.value.date || 
        !appointmentForm.value.patient || 
        !appointmentForm.value.therapistDoctor || 
        !appointmentForm.value.serviceId ||
        !appointmentForm.value.duration_type ||
        (!isAdmin && !appointmentForm.value.start_time)) {
      errorMessage.value = "Please fill in all required fields";
      return;
    }

    if (appointmentForm.value.duration_type === 'custom' && !appointmentForm.value.custom_end_time) {
      errorMessage.value = "Please select a custom end time";
      return;
    }
    
    if (!isAdmin && !appointmentForm.value.start_time) {
      errorMessage.value = "Please select a start time";
      return;
    }

    // Only block when re-activating a cancelled appointment without sessions.
    if (editBlocksDueToSessions.value) {
      errorMessage.value = `Cannot re-activate appointment. ${patientSessionInfo.value.patient_name}: ${sessionCapText(patientSessionInfo.value)}`;
      return;
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
      status: newStatus,
      is_admin_appointment: appointmentForm.value.therapistDoctor === 'admin',
      ...buildTimePayload(),
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
       if (blurTimeout.value) {
         clearTimeout(blurTimeout.value);
         blurTimeout.value = null;
       }
       isSelectingPatient.value = false;
       patientSearchText.value = '';
       showPatientDropdown.value = false;
       filteredPatients.value = [];
       
       // Close modal and refresh appointments
       showEditModal.value = false;
       isEditing.value = false;
       await refreshAppointments(); // Now refreshes both list and calendar
       if (newStatus === 41) promptToBill(appointmentData.appointment_id);
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
  // FullCalendar event ids are strings while API ids are numbers
  return rawData.value.find(appt => String(appt.id) === String(id));
}

// Function to extract only the time part from the time slot string
function extractTimeOnly(timeSlot) {
  if (!timeSlot) return 'Unknown Time';

  // Legacy format: "Slot 2 : 10.00 am - 11.00 am" -> strip the "Slot X : " prefix
  const labelSeparatorIndex = timeSlot.indexOf(' : ');
  if (labelSeparatorIndex !== -1) {
    return timeSlot.substring(labelSeparatorIndex + 3).trim();
  }

  // Admin format: "Admin - 9:00 AM - 10:00 AM" -> strip the leading "Admin - " prefix
  if (timeSlot.startsWith('Admin - ')) {
    return timeSlot.substring('Admin - '.length).trim();
  }

  // New format: "9:00 AM - 10:00 AM" is already time-only
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

// Watch for activeTab changes to refresh the calendar when switching to calendar view
watch(() => activeTab.value, (newTab) => {
  if (newTab === 'calendar') {
    applyCalendarFilter();
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

  if (!confirm(`Are you sure you want to cancel this appointment? One session will be added back to the patient's available sessions.${billedCancelWarning(selectedAppointment.value)}`)) {
    return;
  }
  
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
  // 'all' | 'admin' | 'assigned' and the "Show cancelled" toggle are handled in one place.
  syncCalendarEventsFromRawData();
};

// Function to filter patients based on search text
const filterPatients = (searchText) => {
  if (!searchText || !optionsData.value?.patients) {
    filteredPatients.value = [];
    return;
  }
  
  // Debug: show the actual patient object structure
  if (optionsData.value.patients.length > 0) {
    const firstPatient = optionsData.value.patients[0];
    console.log('First patient object:', firstPatient);
    console.log('First patient keys:', Object.keys(firstPatient));
    console.log('First patient values:', Object.values(firstPatient));
    console.log('First patient label:', firstPatient.label);
    console.log('First patient value:', firstPatient.value);
    console.log('First patient IC:', firstPatient.patient_ic);
  }
  
  const searchLower = searchText.toLowerCase();
  filteredPatients.value = optionsData.value.patients.filter(patient => {
    const nameMatch = patient.label?.toLowerCase().includes(searchLower);
    
    // Check for IC match using the correct field name
    const icMatch = patient.patient_ic && patient.patient_ic.toString().toLowerCase().includes(searchLower);
    
    console.log(`Patient: ${patient.label}, IC Value: ${patient.patient_ic}, Name match: ${nameMatch}, IC match: ${icMatch}`);
    
    return nameMatch || icMatch;
  });
  
  console.log('Filtered patients:', filteredPatients.value);
  console.log('Search text:', searchText);
};

// Function to select a patient
const selectPatient = (patient) => {
  console.log('selectPatient called with:', patient); // Debug log
  
  // Validate patient data first
  if (!validatePatientData(patient)) {
    console.error('Invalid patient data:', patient);
    return;
  }
  
  // Set flag to prevent blur conflicts
  isSelectingPatient.value = true;
  
  // Clear any pending blur timeout immediately
  if (blurTimeout.value) {
    clearTimeout(blurTimeout.value);
    blurTimeout.value = null;
  }
  
  // Set the patient data immediately
  appointmentForm.value.patient = patient.value;
  patientSearchText.value = patient.label;
  
  // Hide the dropdown immediately and clear search results
  showPatientDropdown.value = false;
  filteredPatients.value = [];
  
  console.log('Patient selected:', {
    patientId: patient.value,
    patientName: patient.label,
    formPatient: appointmentForm.value.patient,
    searchText: patientSearchText.value
  });
  
  // Reset the flag after a longer delay to ensure all events are processed
  setTimeout(() => {
    isSelectingPatient.value = false;
    // Double-check that dropdown is still hidden
    if (appointmentForm.value.patient) {
      showPatientDropdown.value = false;
      filteredPatients.value = [];
    }
  }, 300);
  
  // Check patient sessions when a patient is selected
  if (patient.value) {
    checkPatientSessions(patient.value);
  }
};

// Function to clear patient selection
const clearPatientSelection = () => {
  // Clear any pending blur timeout
  if (blurTimeout.value) {
    clearTimeout(blurTimeout.value);
    blurTimeout.value = null;
  }
  
  // Reset selection flag
  isSelectingPatient.value = false;
  
  appointmentForm.value.patient = '';
  patientSearchText.value = '';
  showPatientDropdown.value = false;
  patientSessionInfo.value = null;
};

// Handle patient input focus
const handlePatientFocus = () => {
  // Clear any pending blur timeout immediately
  if (blurTimeout.value) {
    clearTimeout(blurTimeout.value);
    blurTimeout.value = null;
  }
  
  // Reset selection flag
  isSelectingPatient.value = false;
  
  // Only show dropdown if no patient is selected
  if (!appointmentForm.value.patient) {
    showPatientDropdown.value = true;
  }
};

// Handle patient input blur
const handlePatientBlur = () => {
  // If we're in the middle of selecting a patient, don't hide the dropdown
  if (isSelectingPatient.value) {
    return;
  }
  
  // If a patient is already selected, don't show the dropdown
  if (appointmentForm.value.patient) {
    showPatientDropdown.value = false;
    filteredPatients.value = [];
    return;
  }
  
  // Use a longer timeout to allow click events to register
  blurTimeout.value = setTimeout(() => {
    // Only hide if no patient is selected and we're not in selection mode
    if (!appointmentForm.value.patient && !isSelectingPatient.value) {
      showPatientDropdown.value = false;
    }
  }, 200); // Increased timeout to allow click events to register
};

// Helper function to get patient IC from the correct field name
const getPatientIC = (patient) => {
  return patient.patient_ic || null;
};

// Function to validate patient data structure
const validatePatientData = (patient) => {
  if (!patient) return false;
  
  const hasRequiredFields = patient.value && patient.label;
  const hasValidValue = typeof patient.value === 'number' || typeof patient.value === 'string';
  
  console.log('Patient validation:', {
    patient,
    hasRequiredFields,
    hasValidValue,
    valueType: typeof patient.value,
    labelType: typeof patient.label
  });
  
  return hasRequiredFields && hasValidValue;
};

</script>

<template>
  <div>
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

            <!-- List filters -->
            <div v-if="!appointmentsLoading" class="mb-4 flex flex-wrap gap-4 items-center">
              <div class="flex items-center space-x-2">
                <label class="text-sm font-medium text-gray-700">Filter:</label>
                <select
                  v-model="listFilter"
                  class="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Appointments</option>
                  <option value="next">Next Appointments</option>
                </select>
              </div>

              <div
                v-if="listFilter === 'next'"
                class="text-sm text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200"
              >
                <Icon name="material-symbols:schedule" class="mr-1" size="16" />
                Showing upcoming appointments sorted by nearest date &amp; time
              </div>
            </div>

            <!-- Loading indicator -->
            <div v-if="appointmentsLoading" class="flex justify-center my-8">
              <div class="text-center">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p class="text-gray-500">Refreshing appointments...</p>
              </div>
            </div>

            <!-- No appointments message -->
            <div v-else-if="filteredListAppointments.length === 0" class="text-center py-8 text-gray-500">
              <template v-if="listFilter === 'next'">
                No upcoming appointments found.
              </template>
              <template v-else>
                No appointments found. Click "Add Appointment" to create a new one.
              </template>
            </div>

            <!-- Appointment Table -->
            <rs-table
              v-else
              :data="filteredListAppointments"
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
                <!-- Billing state: administrators only (the API omits it for doctors) -->
                <span
                  v-if="canSeeBilling && getBillingStateMeta(getOriginalData(row.value.id)?.billingState)"
                  class="ml-1 px-2 py-1 text-xs font-semibold rounded-full"
                  :class="getBillingStateMeta(getOriginalData(row.value.id).billingState).badgeClass"
                >
                  {{ getBillingStateMeta(getOriginalData(row.value.id).billingState).label }}
                </span>
              </template>
              
              <!-- Actions column -->
              <template v-slot:action="row">
                <div class="table-action-group">
                  <!-- Edit Icon -->
                  <button
                    type="button"
                    class="table-action-icon table-action-icon--primary"
                    title="Edit Appointment"
                    @click="() => editAppointment(row.value.id)"
                  >
                    <Icon name="material-symbols:edit-outline-rounded" size="22" />
                  </button>

                  <!-- View Icon -->
                  <button
                    type="button"
                    class="table-action-icon table-action-icon--primary"
                    title="View Appointment Details"
                    @click="() => viewAppointmentDetails(row.value)"
                  >
                    <Icon name="material-symbols:visibility-outline-rounded" size="22" />
                  </button>

                  <!-- Download PDF -->
                  <button
                    type="button"
                    class="table-action-icon table-action-icon--primary"
                    title="Download Appointment"
                    :disabled="printingAppointmentId === row.value.id"
                    @click="() => downloadAppointmentPdf(getOriginalData(row.value.id))"
                  >
                    <Icon
                      :name="printingAppointmentId === row.value.id ? 'line-md:loading-twotone-loop' : 'material-symbols:download-outline'"
                      size="22"
                    />
                  </button>

                  <!-- Delete Icon -->
                  <button
                    type="button"
                    class="table-action-icon table-action-icon--danger"
                    title="Delete Appointment"
                    @click="() => confirmDeleteAppointment(row.value.id)"
                  >
                    <Icon name="material-symbols:delete-outline" size="22" />
                  </button>
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
              
              <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  v-model="showCancelled"
                  type="checkbox"
                  class="rounded border-gray-300"
                  @change="applyCalendarFilter"
                />
                Show cancelled
              </label>

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
                <div v-for="status in APPOINTMENT_STATUS_LIST" :key="status.value" class="flex items-center">
                  <div class="w-4 h-4 rounded mr-2" :style="{ backgroundColor: status.color }"></div>
                  <span>{{ status.label }}</span>
                  <span v-if="status.symbol === '✓' || status.symbol === '✕'" class="ml-1 text-gray-500">({{ status.symbol }})</span>
                </div>
                <div class="flex items-center">
                  <span class="mr-2 inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-extrabold text-white" style="background-color: #ea580c;">A</span>
                  <span>Admin appointment (no practitioner yet)</span>
                </div>
                <div v-if="canSeeBilling" class="flex items-center">
                  <span class="mr-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-extrabold" style="background-color: #fbbf24; color: #78350f;">$</span>
                  <span>Still to bill / waiting for payment</span>
                </div>
              </div>
              <p class="mt-2 text-xs text-gray-500">
                A day shows its first 3 appointments. Click "+N more" to see all of them with the full time, service and practitioner.
              </p>
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
            <button @click="showModal = false" class="text-gray-500 hover:text-gray-700" title="Close">
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
                    @focus="handlePatientFocus"
                    @blur="handlePatientBlur"
                    @click.stop
                    placeholder="Type patient name or IC number..."
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    :class="{ 'border-red-500': !appointmentForm.patient && patientSearchText }"
                  />
                  <div v-if="appointmentForm.patient" class="absolute right-2 top-2">
                    <button
                      type="button"
                      @click="clearPatientSelection"
                      class="text-gray-400 hover:text-gray-600"
                      title="Clear Selection"
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
                    @mousedown.prevent="selectPatient(patient)"
                    @click.stop
                    class="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                  >
                    <div class="font-medium">{{ patient.label }}</div>
                    <div v-if="getPatientIC(patient)" class="text-sm text-gray-600">
                      IC: {{ getPatientIC(patient) }}
                    </div>
                  </div>
                </div>
                
                <!-- Validation Error -->
                <div v-if="!appointmentForm.patient && patientSearchText" class="mt-1 text-sm text-red-600">
                  Please select a patient from the dropdown
                </div>
              </div>
              
              <!-- Patient Session Information -->
              <div v-if="patientSessionInfo" class="p-3 rounded-lg border" :class="sessionBanner.box">
                <div class="flex items-start">
                  <Icon
                    :name="sessionBannerIcon"
                    :class="sessionBanner.icon"
                    size="20"
                    class="mr-2 mt-0.5"
                  />
                  <div>
                    <p class="text-sm font-medium" :class="sessionBanner.title">
                      {{ patientSessionInfo.patient_name }}
                    </p>
                    <p class="text-xs" :class="sessionBanner.text">
                      Available Sessions: {{ patientSessionInfo.available_sessions }}
                      <span v-if="patientSessionInfo.owed_sessions > 0">(already owes {{ patientSessionInfo.owed_sessions }})</span>
                      <span v-if="!patientSessionInfo.can_book_appointment" class="font-medium"> - {{ sessionCapText(patientSessionInfo) }}</span>
                      <span v-else-if="patientSessionInfo.will_be_unbilled" class="font-medium"> - No sessions left. This booking will be marked <strong>unbilled</strong>; create an invoice afterwards to collect payment.</span>
                      <span v-else class="text-gray-500"> ({{ patientSessionInfo.sessions_after_booking }} left after this booking)</span>
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
                    <span>Admin placeholder booking. Assign a real practitioner on the appointment date. Overlap is checked when assigned.</span>
                  </div>
                </div>
              </div>
              
              <div class="relative">
                <FormKit type="select" v-model="appointmentForm.start_time" name="start_time" label="Start Time" :options="startTimeOptions" validation="required" :disabled="!appointmentForm.date || !appointmentForm.therapistDoctor || isLoadingSlots || (patientSessionInfo && !patientSessionInfo.can_book_appointment)" />
                <div v-if="isLoadingSlots" class="absolute right-2 top-8">
                  <Icon name="line-md:loading-twotone-loop" class="text-primary" />
                </div>
                <div v-if="startTimeOptions.length === 1 && appointmentForm.date && appointmentForm.therapistDoctor" class="text-red-500 text-sm mt-1">
                  <span v-if="appointmentForm.therapistDoctor === 'admin'">
                    No available start times for the selected date
                  </span>
                  <span v-else>
                    No available start times for the selected date and practitioner
                  </span>
                </div>
              </div>

              <FormKit type="select" v-model="appointmentForm.duration_type" name="duration_type" label="Duration" :options="durationOptions" validation="required" :disabled="patientSessionInfo && !patientSessionInfo.can_book_appointment" />

              <FormKit
                v-if="appointmentForm.duration_type === 'custom'"
                type="select"
                v-model="appointmentForm.custom_end_time"
                name="custom_end_time"
                label="End Time"
                :options="customEndOptions"
                validation="required"
                :disabled="!appointmentForm.start_time || isLoadingSlots || (patientSessionInfo && !patientSessionInfo.can_book_appointment)"
              />

              <div
                v-if="appointmentForm.duration_type === 'custom' && appointmentForm.start_time && appointmentForm.therapistDoctor !== 'admin'"
                class="text-sm text-gray-600"
              >
                Only end times that do not overlap with this therapist's existing bookings are shown.
              </div>

              <div v-if="computedEndTime" class="p-3 bg-gray-50 border border-gray-200 rounded text-sm">
                <span class="text-gray-600">Calculated end time:</span>
                <span class="font-medium ml-2">{{ formatTime12h(computedEndTime) }}</span>
              </div>

              <div v-if="appointmentForm.therapistDoctor === 'admin' && appointmentForm.date" class="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                <div class="flex items-center text-blue-700">
                  <Icon name="material-symbols:info" size="16" class="mr-2" />
                  <span>Admin placeholder bookings may overlap. Assign a real practitioner later; overlap will be checked at assignment.</span>
                </div>
              </div>
              
              <FormKit type="select" v-model="appointmentForm.status" name="status" label="Status" :options="statusOptions" validation="required" :disabled="patientSessionInfo && !patientSessionInfo.can_book_appointment" />
            </FormKit>
          </div>

          <!-- Fixed Footer with Buttons -->
          <div class="p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <div v-if="errorMessage" class="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {{ errorMessage }}
            </div>
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
            <button @click="showDetailsModal = false" class="text-gray-500 hover:text-gray-700" title="Close">
              <Icon name="material-symbols:close" size="24" />
            </button>
          </div>

          <div class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p class="text-sm text-gray-500">Patient</p>
                <p class="font-medium">{{ selectedAppointment.patientName }}</p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Practitioner</p>
                <p class="font-medium">{{ selectedAppointment.practitionerName }}</p>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p class="text-sm text-gray-500">Session Number</p>
                <p class="font-medium">
                  {{ selectedAppointment.sessionNumber ?? '-' }}
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

            <!-- Billing (administrators only) -->
            <div v-if="canSeeBilling && getBillingStateMeta(selectedAppointment.billingState)">
              <p class="text-sm text-gray-500">Billing</p>
              <p class="font-medium">
                <span
                  class="px-2 py-1 text-xs font-semibold rounded-full"
                  :class="getBillingStateMeta(selectedAppointment.billingState).badgeClass"
                >
                  {{ getBillingStateMeta(selectedAppointment.billingState).label }}
                </span>
                <NuxtLink
                  v-if="selectedAppointment.invoiceId"
                  :to="`/payment/viewInvoice/${selectedAppointment.invoiceId}`"
                  class="ml-2 text-sm text-primary underline"
                >
                  {{ formatInvoiceNumber(selectedAppointment.invoiceId) }}
                </NuxtLink>
              </p>
              <p v-if="selectedAppointment.billingState === 'unbilled'" class="text-xs text-gray-500 mt-1">
                Booked without a prepaid session. Bill it so the parent can pay.
              </p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div class="mt-6 flex justify-center gap-3 flex-wrap">
            <rs-button
              variant="secondary-outline"
              @click="downloadSelectedAppointmentPdf"
              :disabled="printingAppointmentId === selectedAppointment.id"
            >
              <Icon
                :name="printingAppointmentId === selectedAppointment.id ? 'line-md:loading-twotone-loop' : 'material-symbols:download-outline'"
                class="mr-1"
                size="18"
              />
              <span v-if="printingAppointmentId === selectedAppointment.id">Generating PDF...</span>
              <span v-else>Download PDF</span>
            </rs-button>
            <rs-button variant="primary-outline" @click="openEditFromDetails">
              <Icon name="material-symbols:edit-outline-rounded" size="18" class="mr-1" />
              Edit
            </rs-button>
            <rs-button
              v-if="canSeeBilling && selectedAppointment.billingState === 'unbilled' && selectedAppointment.status !== 37"
              variant="success"
              @click="billSession(selectedAppointment)"
            >
              <Icon name="material-symbols:receipt-long-outline" size="18" class="mr-1" />
              Bill this session
            </rs-button>
            <rs-button
              v-if="selectedAppointment.status !== 37"
              variant="danger"
              @click="cancelAppointment"
              :disabled="isLoading"
            >
              <span v-if="isLoading">Cancelling...</span>
              <span v-else>Cancel Appointment</span>
            </rs-button>
            <rs-button variant="primary" @click="showDetailsModal = false">Close</rs-button>
          </div>
        </div>
      </div>
      
      <!-- Delete Confirmation Modal -->
      <div v-if="showDeleteModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold">Confirm Delete</h2>
            <button @click="showDeleteModal = false" class="text-gray-500 hover:text-gray-700" title="Close">
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
            <button @click="showEditModal = false" class="text-gray-500 hover:text-gray-700" title="Close">
              <Icon name="material-symbols:close" size="24" />
            </button>
          </div>

          <!-- Scrollable Content -->
          <div class="flex-1 overflow-y-auto p-6">
            <FormKit type="form" :actions="false">
              <FormKit type="date" v-model="appointmentForm.date" name="date" label="Date" validation="required" />
              
              <!-- Patient Name Display (Read-only in Edit Mode) -->
              <div class="relative">
                <label class="block text-sm font-medium text-gray-700 mb-2">Patient Name</label>
                <div class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
                  {{ patientSearchText || 'No patient selected' }}
                </div>
              </div>
              
              <!-- Patient Session Information (edit: session already held unless cancelled) -->
              <div v-if="patientSessionInfo" class="p-3 rounded-lg border" :class="editSessionAlreadyReserved ? 'bg-blue-50 border-blue-200' : sessionBanner.box">
                <div class="flex items-start">
                  <Icon
                    :name="editSessionAlreadyReserved ? 'material-symbols:info' : sessionBannerIcon"
                    :class="editSessionAlreadyReserved ? 'text-blue-600' : sessionBanner.icon"
                    size="20"
                    class="mr-2 mt-0.5"
                  />
                  <div>
                    <p class="text-sm font-medium" :class="editSessionAlreadyReserved ? 'text-blue-800' : sessionBanner.title">
                      {{ patientSessionInfo.patient_name }}
                    </p>
                    <p class="text-xs" :class="editSessionAlreadyReserved ? 'text-blue-600' : sessionBanner.text">
                      Available Sessions: {{ patientSessionInfo.available_sessions }}
                      <span v-if="editSessionAlreadyReserved" class="font-medium"> — session already reserved for this appointment</span>
                      <span v-else-if="!patientSessionInfo.can_book_appointment" class="font-medium"> — {{ sessionCapText(patientSessionInfo) }}</span>
                      <span v-else-if="patientSessionInfo.will_be_unbilled" class="font-medium"> — no sessions left: re-activating will mark it <strong>unbilled</strong></span>
                      <span v-else class="text-gray-500"> (1 session will be used if re-activating)</span>
                    </p>
                  </div>
                </div>
              </div>
              
              <FormKit type="select" v-model="appointmentForm.serviceId" name="serviceId" label="Service" :options="serviceOptions" validation="required" />
              
              <div v-if="isCancellingEdit" class="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                <div class="flex items-start">
                  <Icon name="material-symbols:info" size="16" class="mr-2 mt-0.5 shrink-0" />
                  <span>Cancelling this appointment will return one session to the patient. Time and practitioner fields are not required.</span>
                </div>
              </div>

              <template v-if="!isCancellingEdit">
              <!-- Therapist/Doctor Selection with Admin Option -->
              <div class="relative">
                <FormKit type="select" v-model="appointmentForm.therapistDoctor" name="therapistDoctor" label="Therapist/Doctor" :options="therapistDoctorOptions" validation="required" />
                
                <!-- Show available admin slots info -->
                <div v-if="appointmentForm.therapistDoctor === 'admin' && appointmentForm.date" class="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                  <div class="flex items-center text-blue-700">
                    <Icon name="material-symbols:info" size="16" class="mr-2" />
                    <span>Admin placeholder booking. Assign a real practitioner on the appointment date. Overlap is checked when assigned.</span>
                  </div>
                </div>
              </div>
              
              <div class="relative">
                <FormKit type="select" v-model="appointmentForm.start_time" name="start_time" label="Start Time" :options="startTimeOptions" validation="required" :disabled="!appointmentForm.date || !appointmentForm.therapistDoctor || isLoadingSlots" />
                <div v-if="isLoadingSlots" class="absolute right-2 top-8">
                  <Icon name="line-md:loading-twotone-loop" class="text-primary" />
                </div>
                <div v-if="startTimeOptions.length === 1 && appointmentForm.date && appointmentForm.therapistDoctor" class="text-red-500 text-sm mt-1">
                  <span v-if="appointmentForm.therapistDoctor === 'admin'">
                    No available start times for the selected date
                  </span>
                  <span v-else>
                    No available start times for the selected date and practitioner
                  </span>
                </div>
              </div>

              <FormKit type="select" v-model="appointmentForm.duration_type" name="duration_type" label="Duration" :options="durationOptions" validation="required" />

              <FormKit
                v-if="appointmentForm.duration_type === 'custom'"
                type="select"
                v-model="appointmentForm.custom_end_time"
                name="custom_end_time"
                label="End Time"
                :options="customEndOptions"
                validation="required"
                :disabled="!appointmentForm.start_time || isLoadingSlots"
              />

              <div
                v-if="appointmentForm.duration_type === 'custom' && appointmentForm.start_time && appointmentForm.therapistDoctor !== 'admin'"
                class="text-sm text-gray-600"
              >
                Only end times that do not overlap with this therapist's existing bookings are shown.
              </div>

              <div v-if="computedEndTime" class="p-3 bg-gray-50 border border-gray-200 rounded text-sm">
                <span class="text-gray-600">Calculated end time:</span>
                <span class="font-medium ml-2">{{ formatTime12h(computedEndTime) }}</span>
              </div>

              <div v-if="appointmentForm.therapistDoctor === 'admin' && appointmentForm.date" class="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                <div class="flex items-center text-blue-700">
                  <Icon name="material-symbols:info" size="16" class="mr-2" />
                  <span>Admin placeholder bookings may overlap. Assign a real practitioner later; overlap will be checked at assignment.</span>
                </div>
              </div>
              </template>
              
              <FormKit type="select" v-model="appointmentForm.status" name="status" label="Status" :options="statusOptions" validation="required" />
            </FormKit>
          </div>

          <!-- Fixed Footer with Buttons -->
          <div class="p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <div v-if="errorMessage" class="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {{ errorMessage }}
            </div>
            <div class="flex justify-end gap-2">
              <rs-button variant="secondary-outline" @click="showEditModal = false">Close</rs-button>
              <rs-button
                v-if="isCancellingEdit"
                variant="danger"
                @click="saveEditedAppointment"
                :disabled="isLoading"
              >
                <span v-if="isLoading">Cancelling...</span>
                <span v-else>Cancel Appointment</span>
              </rs-button>
              <rs-button v-else variant="primary" @click="saveEditedAppointment" :disabled="isLoading || editBlocksDueToSessions">
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
            <button @click="showCommentModal = false" class="text-gray-500 hover:text-gray-700" title="Close">
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
            <button @click="showRatingModal = false" class="text-gray-500 hover:text-gray-700" title="Close">
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
                :title="`Rate ${i} star${i > 1 ? 's' : ''}`"
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
            <button @click="showDeleteModal = false" class="text-gray-500 hover:text-gray-700" title="Close">
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
  </div>
</template>

<style>
.fc {
  background-color: #fff; /* calendar background white */
}

.fc .fc-event {
  cursor: pointer;
}
</style>
