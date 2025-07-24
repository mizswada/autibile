<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const patientId = computed(() => route.query.patientId || route.params.id);

// States
const isLoading = ref(true);
const error = ref(null);
const activeTab = ref('Patient Details');
const retryCount = ref(0);
const maxRetries = 3;
const retryDelay = 3000; // 3 seconds
const isRetrying = ref(false);

// Data
const patientDetails = ref(null);
const parentDetails = ref(null);
const appointments = ref([]);
const questionnaires = ref([]);
const doctorReferrals = ref([]);
const diaryReportData = ref(null);
const collapsedQnA = ref({});
const scoreThresholds = ref({});
const thresholdsLoading = ref(false);
const isGeneratingReport = ref(false);

// Pagination for appointments
const currentPage = ref(1);
const itemsPerPage = ref(10);
const appointmentsLoading = ref(false);

// Tabs
const tabs = [
  'Patient Details',
  'Parent Details',
  'Appointments',
  'Questionnaires',
  'Doctor Referrals',
  'Diary Report'
];

// Computed properties for appointments pagination
const paginatedAppointments = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return appointments.value.slice(start, end);
});

const totalPages = computed(() => {
  return Math.ceil(appointments.value.length / itemsPerPage.value);
});

const hasNextPage = computed(() => {
  return currentPage.value < totalPages.value;
});

const hasPrevPage = computed(() => {
  return currentPage.value > 1;
});

onMounted(async () => {
  if (!patientId.value) {
    error.value = 'No patient ID provided';
    isLoading.value = false;
    return;
  }
  await loadAllData();
});

async function loadAllData() {
  isLoading.value = true;
  error.value = null;
  isRetrying.value = false;

  try {
    await Promise.all([
      fetchPatientDetails(),
      fetchParentDetails(),
      fetchAppointments(),
      fetchQuestionnaires(),
      fetchDoctorReferrals(),
      fetchDiaryReport()
    ]);
    retryCount.value = 0; // Reset on success
  } catch (err) {
    console.error(err);
    if (retryCount.value < maxRetries) {
      isRetrying.value = true;
      retryCount.value++;
      setTimeout(() => {
        loadAllData();
      }, retryDelay);
    } else {
      error.value = 'Failed to load patient data';
      isRetrying.value = false;
    }
  } finally {
    if (!isRetrying.value) isLoading.value = false;
  }
}

async function fetchPatientDetails() {
  const res = await fetch(`/api/parents/manageChild/fetchEditChild?childID=${patientId.value}`);
  const data = await res.json();
  if (data.statusCode === 200) patientDetails.value = data.data;
}

async function fetchParentDetails() {
  // 1. Get parent ID from child ID
  const res = await fetch(`/api/parents/manageChild/getParentByChild?childID=${patientId.value}`);
  const data = await res.json();
  if (data.statusCode === 200 && data.data && data.data.parent_id) {
    const parentId = data.data.parent_id;
    // 2. Get all parents and find the matching parent
    const parentRes = await fetch('/api/parents/listParents');
    const parentData = await parentRes.json();
    if (parentData.statusCode === 200 && Array.isArray(parentData.data)) {
      const found = parentData.data.find(p => String(p.parentID) === String(parentId));
      if (found) parentDetails.value = found;
    }
  }
}

async function fetchAppointments() {
  appointmentsLoading.value = true;
  try {
    // For patient profile, we want to show ALL appointments including cancelled and deleted ones
    const res = await fetch(`/api/appointments/listAll?patient_id=${patientId.value}`);
    const data = await res.json();
    if (data.success) {
      appointments.value = data.data;
      // Reset to first page when data changes
      currentPage.value = 1;
    }
  } catch (error) {
    console.error('Error fetching appointments:', error);
  } finally {
    appointmentsLoading.value = false;
  }
}

// Pagination functions
function goToPage(page) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
}

function nextPage() {
  if (hasNextPage.value) {
    currentPage.value++;
  }
}

function prevPage() {
  if (hasPrevPage.value) {
    currentPage.value--;
  }
}

function changeItemsPerPage(newCount) {
  itemsPerPage.value = parseInt(newCount);
  currentPage.value = 1; // Reset to first page
}

async function fetchQuestionnaires() {
  const res = await fetch(`/api/questionnaire/responses/list?patientId=${patientId.value}`);
  const data = await res.json();
  if (data.statusCode === 200) {
    questionnaires.value = data.data;
    // Fetch thresholds for all unique questionnaire_ids
    const uniqueIds = [...new Set(data.data.map(q => q.questionnaire_id))];
    thresholdsLoading.value = true;
    await Promise.all(uniqueIds.map(async (qid) => {
      if (!scoreThresholds.value[qid]) {
        const tRes = await fetch(`/api/questionnaire/thresholds?questionnaireId=${qid}`);
        const tData = await tRes.json();
        if (tData.statusCode === 200 && Array.isArray(tData.data)) {
          scoreThresholds.value[qid] = tData.data;
        } else {
          scoreThresholds.value[qid] = [];
        }
      }
    }));
    thresholdsLoading.value = false;
  }
}

async function fetchDoctorReferrals() {
  const res = await fetch(`/api/patientProfile/referrals?patientId=${patientId.value}`);
  const data = await res.json();
  if (data.statusCode === 200) doctorReferrals.value = data.data;
}

async function fetchDiaryReport() {
  const res = await fetch('/api/diaryReport/generatePdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ patientId: patientId.value })
  });
  const data = await res.json();
  if (data.statusCode === 200) diaryReportData.value = data.data;
}

async function generateDiaryReport() {
  isGeneratingReport.value = true;
  try {
    await fetchDiaryReport();
    // You could add a success message here if needed
  } catch (error) {
    console.error('Error generating diary report:', error);
  } finally {
    isGeneratingReport.value = false;
  }
}

function calculateAge(dob) {
  if (!dob) return 'N/A';
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age + ' years';
}

function displayScore(score) {
  return score == null ? 0 : score;
}

function getPatientName(appt) {
  return (appt.extendedProps && appt.extendedProps.patient_name) || appt.patientName || '-';
}

function getPractitionerName(appt) {
  return (appt.extendedProps && appt.extendedProps.practitioner_name) || appt.practitionerName || (appt.user_practitioners && appt.user_practitioners.user && appt.user_practitioners.user.fullname) || '-';
}

function getServiceName(appt) {
  return (appt.extendedProps && appt.extendedProps.service_name) || appt.serviceName || (appt.service && appt.service.name) || '-';
}

function getTimeSlot(appt) {
  return (appt.extendedProps && appt.extendedProps.time_slot) || appt.timeSlot || appt.time || '-';
}

function getStatus(appt) {
  const status = (appt.extendedProps && appt.extendedProps.status) || appt.status;
  switch (status) {
    case 36: return 'Booked';
    case 37: return 'Cancelled';
    case 38: return 'Started';
    case 39: return 'Confirmed Start';
    case 40: return 'Finished';
    case 41: return 'Completed';
    default: return 'Unknown';
  }
}

function getSessionNumber(appt) {
  return (appt.extendedProps && appt.extendedProps.session_number) || appt.sessionNumber || 1;
}

function getParentComment(appt) {
  return (appt.extendedProps && appt.extendedProps.parent_comment) || appt.parentComment || appt.parent_comment;
}

function getParentRate(appt) {
  return (appt.extendedProps && appt.extendedProps.parent_rate) || appt.parentRate || appt.parent_rate;
}

function getTherapistDoctorComment(appt) {
  return (appt.extendedProps && appt.extendedProps.therapist_doctor_comment) || appt.therapistDoctorComment || appt.therapist_doctor_comment;
}

function getScoreClass(score) {
  const val = parseInt(score);
  if (val > 70) return 'text-red-600';
  if (val > 40) return 'text-yellow-600';
  return 'text-green-600';
}

function toggleQnA(qr_id) {
  collapsedQnA.value[qr_id] = !collapsedQnA.value[qr_id];
}

function formatDateOnly(dateString) {
  if (!dateString) return '';
  return dateString.split('T')[0];
}

function getScoreInterpretation(q) {
  const thresholds = scoreThresholds.value[q.questionnaire_id] || [];
  const score = parseInt(q.total_score);
  return thresholds.find(t => score >= t.scoring_min && score <= t.scoring_max) || null;
}
</script>

<template>
  <div class="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
    <div class="flex items-center justify-between mb-8">
      <h1 class="text-3xl font-bold">Patient Profile</h1>
      <rs-button variant="outline" @click="navigateTo('/patientProfile/select')">
        <Icon name="material-symbols:arrow-back" class="mr-1" />
        Back
      </rs-button>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center items-center py-20">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
      <span v-if="isRetrying" class="ml-4 text-gray-600">Retrying to load data...</span>
      <span v-else class="ml-4 text-gray-600">Loading patient data...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-100 text-red-700 p-4 rounded-lg">{{ error }}</div>

    <!-- Content -->
    <div v-else>
      <!-- Tabs -->
      <div class="flex space-x-4 border-b mb-6">
        <button
          v-for="tab in tabs"
          :key="tab"
          @click="activeTab = tab"
          :class="[
            'px-4 py-2 font-medium',
            activeTab === tab ? 'border-b-4 border-purple-800 text-purple-800' : 'text-gray-600 hover:text-purple-800'
          ]"
        >
          {{ tab }}
        </button>
      </div>

      <!-- Tab Contents -->
      <div class="space-y-6">
        <!-- Patient Details -->
        <div v-if="activeTab === 'Patient Details'">
          <div class="bg-white rounded-xl shadow p-6">
            <h2 class="text-xl font-semibold mb-4 bg-purple-50 text-purple-800 border-b border-purple-200 p-2 rounded-lg">Patient Details</h2>
            <div v-if="patientDetails" class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              <div class="flex"><span class="font-medium w-32 text-left">Full Name</span><span class="mx-2">:</span><span>{{ patientDetails.fullname }}</span></div>
              <div class="flex"><span class="font-medium w-32 text-left">IC Number</span><span class="mx-2">:</span><span>{{ patientDetails.patient_ic }}</span></div>
              <div class="flex"><span class="font-medium w-32 text-left">Gender</span><span class="mx-2">:</span><span>{{ patientDetails.gender }}</span></div>
              <div class="flex"><span class="font-medium w-32 text-left">Date of Birth</span><span class="mx-2">:</span><span>{{ formatDateOnly(patientDetails.dob) }}</span></div>
              <div class="flex"><span class="font-medium w-32 text-left">Age</span><span class="mx-2">:</span><span>{{ calculateAge(patientDetails.dob) }}</span></div>
              <div class="flex"><span class="font-medium w-32 text-left">Autism Diagnosis</span><span class="mx-2">:</span><span>{{ patientDetails.autism_diagnose }}</span></div>
              <div class="flex"><span class="font-medium w-32 text-left">Diagnosed On</span><span class="mx-2">:</span><span>{{ formatDateOnly(patientDetails.diagnosed_on) }}</span></div>
              <div class="flex"><span class="font-medium w-32 text-left">Status</span><span class="mx-2">:</span><span>{{ patientDetails.status }}</span></div>
              <div class="flex"><span class="font-medium w-32 text-left">Available Sessions</span><span class="mx-2">:</span><span>{{ patientDetails.available_session }}</span></div>
            </div>
            <div v-else class="text-gray-400">No patient details found.</div>
          </div>
        </div>

        <!-- Parent Details -->
        <div v-else-if="activeTab === 'Parent Details'">
          <div class="bg-white rounded-xl shadow p-6">
            <h2 class="text-xl font-semibold mb-4 bg-purple-50 text-purple-800 border-b border-purple-200 p-2 rounded-lg">Parent Details</h2>
            <div v-if="parentDetails">
              <h3 class="text-xl font-semibold text-gray-700 border-b pb-2 pt-2 mb-2">Basic Information</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 mb-4">
                <div class="flex"><span class="font-medium w-32 text-left">Full Name</span><span class="mx-2">:</span><span>{{ parentDetails.fullName }}</span></div>
                <div class="flex"><span class="font-medium w-32 text-left">Email</span><span class="mx-2">:</span><span>{{ parentDetails.email }}</span></div>
                <div class="flex"><span class="font-medium w-32 text-left">IC</span><span class="mx-2">:</span><span>{{ parentDetails.ic }}</span></div>
                <div class="flex"><span class="font-medium w-32 text-left">Phone</span><span class="mx-2">:</span><span>{{ parentDetails.phone }}</span></div>
                <div class="flex"><span class="font-medium w-32 text-left">Relationship</span><span class="mx-2">:</span><span>{{ parentDetails.relationship }}</span></div>
                <div class="flex"><span class="font-medium w-32 text-left">Gender</span><span class="mx-2">:</span><span>{{ parentDetails.gender }}</span></div>
                <div class="flex"><span class="font-medium w-32 text-left">Date of Birth</span><span class="mx-2">:</span><span>{{ formatDateOnly(parentDetails.dateOfBirth) }}</span></div>
                <div class="flex"><span class="font-medium w-32 text-left">Nationality</span><span class="mx-2">:</span><span>{{ parentDetails.nationality }}</span></div>
                <div class="flex"><span class="font-medium w-32 text-left">Status</span><span class="mx-2">:</span><span>{{ parentDetails.status }}</span></div>
              </div>
              <h3 class="text-xl font-semibold text-gray-700 border-b pb-2 pt-2 mb-2">Address Information</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                <div class="flex"><span class="font-medium w-32 text-left">Address Line 1</span><span class="mx-2">:</span><span>{{ parentDetails.addressLine1 }}</span></div>
                <div class="flex"><span class="font-medium w-32 text-left">Address Line 2</span><span class="mx-2">:</span><span>{{ parentDetails.addressLine2 }}</span></div>
                <div class="flex"><span class="font-medium w-32 text-left">Address Line 3</span><span class="mx-2">:</span><span>{{ parentDetails.addressLine3 }}</span></div>
                <div class="flex"><span class="font-medium w-32 text-left">City</span><span class="mx-2">:</span><span>{{ parentDetails.city }}</span></div>
                <div class="flex"><span class="font-medium w-32 text-left">Postcode</span><span class="mx-2">:</span><span>{{ parentDetails.postcode }}</span></div>
                <div class="flex"><span class="font-medium w-32 text-left">State</span><span class="mx-2">:</span><span>{{ parentDetails.state }}</span></div>
              </div>
            </div>
            <div v-else class="text-gray-400">No parent details found.</div>
          </div>
        </div>

        <!-- Appointments -->
        <div v-else-if="activeTab === 'Appointments'">
          <div class="bg-white rounded-xl shadow p-6">
            <h2 class="text-xl font-semibold mb-4 bg-purple-50 text-purple-800 border-b border-purple-200 p-2 rounded-lg">Appointments</h2>
            
            <!-- Loading State -->
            <div v-if="appointmentsLoading" class="flex justify-center items-center py-8">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <span class="ml-2 text-gray-600">Loading appointments...</span>
            </div>

            <!-- Appointments Table -->
            <div v-else-if="appointments && appointments.length" class="space-y-4">
              <!-- Table Controls -->
              <div class="flex justify-between items-center">
                <div class="flex items-center space-x-4">
                  <label class="text-sm text-gray-600">Show:</label>
                  <select 
                    v-model="itemsPerPage" 
                    @change="changeItemsPerPage(itemsPerPage)"
                    class="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </select>
                  <span class="text-sm text-gray-600">entries per page</span>
                </div>
                <div class="text-sm text-gray-600">
                  Showing {{ (currentPage - 1) * itemsPerPage + 1 }} to {{ Math.min(currentPage * itemsPerPage, appointments.length) }} of {{ appointments.length }} appointments
                </div>
              </div>

              <!-- Table -->
              <div class="border rounded-lg overflow-hidden">
                <div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                      <tr>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          No
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Time
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Service
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Practitioner
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Rating
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Comments
                        </th>
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                      <tr 
                        v-for="appt in paginatedAppointments" 
                        :key="appt.appointment_id || appt.id"
                        class="hover:bg-gray-50 transition-colors"
                      >
                        <td class="px-6 py-4 text-sm text-gray-900">
                          <span class="font-medium">{{ getSessionNumber(appt) }}</span>
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-900">
                          {{ new Date(appt.start || appt.date).toLocaleDateString() }}
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-900">
                          {{ getTimeSlot(appt) }}
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-900">
                          {{ getServiceName(appt) }}
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-900">
                          {{ getPractitionerName(appt) }}
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-900">
                          <span 
                            class="px-2 py-1 text-xs font-semibold rounded-full"
                            :class="{
                              'bg-yellow-100 text-yellow-800': (appt.extendedProps && appt.extendedProps.status) === 36 || appt.status === 36,
                              'bg-red-100 text-red-800': (appt.extendedProps && appt.extendedProps.status) === 37 || appt.status === 37,
                              'bg-blue-100 text-blue-800': (appt.extendedProps && appt.extendedProps.status) === 38 || appt.status === 38,
                              'bg-green-100 text-green-800': (appt.extendedProps && appt.extendedProps.status) === 39 || appt.status === 39,
                              'bg-purple-100 text-purple-800': (appt.extendedProps && appt.extendedProps.status) === 40 || appt.status === 40,
                              'bg-indigo-100 text-indigo-800': (appt.extendedProps && appt.extendedProps.status) === 41 || appt.status === 41,
                              'bg-gray-100 text-gray-800': true
                            }"
                          >
                            {{ getStatus(appt) }}
                          </span>
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-900">
                          <div v-if="getParentRate(appt)" class="flex items-center">
                            <div class="flex">
                              <Icon 
                                v-for="i in 5" 
                                :key="i" 
                                :name="i <= Number(getParentRate(appt)) ? 'material-symbols:star' : 'material-symbols:star-outline'" 
                                class="text-yellow-500" 
                                size="16" 
                              />
                            </div>
                            <span class="ml-1 text-xs">{{ Number(getParentRate(appt)) }}/5</span>
                          </div>
                          <span v-else class="text-gray-400">-</span>
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-900">
                          <div class="space-y-1">
                            <div v-if="getParentComment(appt)" class="text-xs">
                              <span class="font-medium text-blue-600">Parent:</span> 
                              <span class="truncate max-w-xs block">{{ getParentComment(appt) }}</span>
                            </div>
                            <div v-if="getTherapistDoctorComment(appt)" class="text-xs">
                              <span class="font-medium text-green-600">Practitioner:</span> 
                              <span class="truncate max-w-xs block">{{ getTherapistDoctorComment(appt) }}</span>
                            </div>
                            <span v-if="!getParentComment(appt) && !getTherapistDoctorComment(appt)" class="text-gray-400">-</span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Pagination -->
              <div class="flex justify-between items-center">
                <div class="text-sm text-gray-600">
                  Showing {{ (currentPage - 1) * itemsPerPage + 1 }} to {{ Math.min(currentPage * itemsPerPage, appointments.length) }} of {{ appointments.length }} appointments
                </div>
                <div class="flex items-center space-x-2">
                  <button
                    @click="prevPage"
                    :disabled="!hasPrevPage"
                    class="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  
                  <div class="flex space-x-1">
                    <button
                      v-for="page in Math.min(5, totalPages)"
                      :key="page"
                      @click="goToPage(page)"
                      :class="{
                        'bg-purple-600 text-white': currentPage === page,
                        'bg-white text-gray-700 hover:bg-gray-50': currentPage !== page
                      }"
                      class="px-3 py-1 text-sm border rounded"
                    >
                      {{ page }}
                    </button>
                  </div>
                  
                  <button
                    @click="nextPage"
                    :disabled="!hasNextPage"
                    class="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
            
            <div v-else class="text-gray-400 text-center py-8">
              <Icon name="material-symbols:event" size="48" class="mx-auto mb-4 text-gray-300" />
              <p>No appointments found.</p>
            </div>
          </div>
        </div>

        <!-- Questionnaires -->
        <div v-else-if="activeTab === 'Questionnaires'">
          <div class="bg-white rounded-xl shadow p-6">
            <h2 class="text-xl font-semibold mb-4 bg-purple-50 text-purple-800 border-b border-purple-200 p-2 rounded-lg">Questionnaires</h2>
            
            <div v-if="questionnaires && questionnaires.length" class="space-y-6">
              <!-- Summary Table -->
              <div class="border rounded-lg overflow-hidden">
                <div class="bg-purple-50 px-4 py-2 border-b">
                  <h3 class="text-lg font-medium text-purple-800">Assessment Summary</h3>
                </div>
                <div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                      <tr>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Questionnaire Title
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Score
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Level
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Recommendation
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                      <tr v-for="q in questionnaires" :key="q.qr_id" class="hover:bg-gray-50">
                        <td class="px-6 py-4 text-sm text-gray-900">{{ q.questionnaire_title || 'Assessment' }}</td>
                        <td class="px-6 py-4 text-sm text-gray-900">
                          <span class="font-medium" :class="getScoreClass(q.total_score)">
                            {{ displayScore(q.total_score) }}
                          </span>
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-900">
                          {{ getScoreInterpretation(q)?.interpretation || '-' }}
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-900">
                          {{ getScoreInterpretation(q)?.recommendation || '-' }}
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-900">
                          <button
                            @click="$router.push(`/questionnaire/results/${q.qr_id}?patientId=${patientId}`)"
                            class="text-purple-600 hover:text-purple-800 font-medium flex items-center"
                          >
                            <Icon name="material-symbols:visibility" class="mr-1" />
                            View Details
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>


            </div>
            
            <div v-else class="text-gray-400 text-center py-8">
              <Icon name="material-symbols:quiz" size="48" class="mx-auto mb-4 text-gray-300" />
              <p>No questionnaire responses found.</p>
            </div>
          </div>
        </div>

        <!-- Doctor Referrals -->
        <div v-else-if="activeTab === 'Doctor Referrals'">
          <div class="bg-white rounded-xl shadow p-6">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-semibold bg-purple-50 text-purple-800 border-b border-purple-200 p-2 rounded-lg">Doctor Referrals</h2>
              <rs-button 
                variant="primary" 
                size="sm"
                @click="$router.push(`/patientProfile/referrals?patientId=${patientId}`)"
              >
                <Icon name="material-symbols:add" class="mr-1" />
                Add Referral
              </rs-button>
            </div>
            
            <ul v-if="doctorReferrals && doctorReferrals.length" class="space-y-2">
              <li
                v-for="ref in doctorReferrals"
                :key="ref.id"
                class="border rounded p-3 hover:bg-gray-50"
              >
                <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                  <div>
                    <span class="font-medium">Doctor Name:</span> {{ ref.doctorName }}<br />
                    <span class="font-medium">Specialty:</span> {{ ref.specialty }}<br />
                    <span class="font-medium">Hospital:</span> {{ ref.hospital }}<br />
                    <span class="font-medium">Date:</span> {{ ref.date }}<br />
                    <span class="font-medium">Follow-up Date:</span> {{ ref.followUpDate }}<br />
                    <span class="font-medium">Status:</span> {{ ref.status }}<br />
                    <span class="font-medium">Reason:</span> {{ ref.reason }}<br />
                    <span class="font-medium">Notes:</span> {{ ref.notes }}
                  </div>
                </div>
              </li>
            </ul>
            <div v-else class="text-gray-400 text-center py-8">
              <Icon name="material-symbols:medical-services" size="48" class="mx-auto mb-4 text-gray-300" />
              <p>No doctor referrals found.</p>
              <rs-button 
                variant="primary" 
                class="mt-4"
                @click="$router.push(`/patientProfile/referrals?patientId=${patientId}`)"
              >
                <Icon name="material-symbols:add" class="mr-1" />
                Add First Referral
              </rs-button>
            </div>
          </div>
        </div>

        <!-- Diary Report -->
        <div v-else-if="activeTab === 'Diary Report'">
          <div class="bg-white rounded-xl shadow p-6">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-semibold bg-purple-50 text-purple-800 border-b border-purple-200 p-2 rounded-lg">Diary Report</h2>
              <rs-button 
                variant="primary" 
                size="sm"
                @click="generateDiaryReport"
                :disabled="isGeneratingReport"
              >
                <Icon name="material-symbols:download" class="mr-1" />
                {{ isGeneratingReport ? 'Generating...' : 'Generate Report' }}
              </rs-button>
            </div>
            
            <div v-if="diaryReportData" class="space-y-6">
              <!-- Patient Summary -->
              <div class="bg-gray-50 p-4 rounded-lg">
                <h3 class="text-lg font-semibold text-gray-800 mb-3">Patient Summary</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span class="font-medium text-gray-600">Name:</span>
                    <span class="ml-2">{{ diaryReportData.patient?.fullname || 'N/A' }}</span>
                  </div>
                  <div>
                    <span class="font-medium text-gray-600">IC Number:</span>
                    <span class="ml-2">{{ diaryReportData.patient?.patient_ic || 'N/A' }}</span>
                  </div>
                  <div>
                    <span class="font-medium text-gray-600">Age:</span>
                    <span class="ml-2">{{ calculateAge(diaryReportData.patient?.dob) }}</span>
                  </div>
                  <div>
                    <span class="font-medium text-gray-600">Autism Diagnosis:</span>
                    <span class="ml-2">{{ diaryReportData.patient?.autism_diagnose || 'N/A' }}</span>
                  </div>
                </div>
              </div>

              <!-- Parent Information -->
              <div class="bg-gray-50 p-4 rounded-lg">
                <h3 class="text-lg font-semibold text-gray-800 mb-3">Parent Information</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span class="font-medium text-gray-600">Parent Name:</span>
                    <span class="ml-2">{{ diaryReportData.parent?.fullName || 'N/A' }}</span>
                  </div>
                  <div>
                    <span class="font-medium text-gray-600">Email:</span>
                    <span class="ml-2">{{ diaryReportData.parent?.email || 'N/A' }}</span>
                  </div>
                  <div>
                    <span class="font-medium text-gray-600">Phone:</span>
                    <span class="ml-2">{{ diaryReportData.parent?.phone || 'N/A' }}</span>
                  </div>
                  <div>
                    <span class="font-medium text-gray-600">Relationship:</span>
                    <span class="ml-2">{{ diaryReportData.parent?.relationship || 'N/A' }}</span>
                  </div>
                </div>
              </div>

              <!-- Questionnaire Responses Summary -->
              <div class="bg-gray-50 p-4 rounded-lg">
                <h3 class="text-lg font-semibold text-gray-800 mb-3">Questionnaire Responses Summary</h3>
                <div v-if="diaryReportData.responses && diaryReportData.responses.length > 0" class="space-y-3">
                  <div v-for="response in diaryReportData.responses" :key="response.id" class="border-l-4 border-blue-500 pl-4">
                    <div class="flex justify-between items-start">
                      <div>
                        <h4 class="font-medium text-gray-800">{{ response.questionnaires?.title || 'Unknown Questionnaire' }}</h4>
                        <p class="text-sm text-gray-600">Completed on: {{ formatDateOnly(response.created_at) }}</p>
                        <p class="text-sm text-gray-600">Total Score: {{ response.total_score || 'N/A' }}</p>
                      </div>
                      <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        {{ response.questionnaires?.type || 'Assessment' }}
                      </span>
                    </div>
                  </div>
                </div>
                <div v-else class="text-gray-500 text-center py-4">
                  <Icon name="material-symbols:quiz" size="32" class="mx-auto mb-2 text-gray-300" />
                  <p>No questionnaire responses available for this patient.</p>
                </div>
              </div>

              <!-- Report Generation Info -->
              <div class="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <h3 class="text-lg font-semibold text-blue-800 mb-2">Report Information</h3>
                <div class="text-sm text-blue-700">
                  <p><span class="font-medium">Generated:</span> {{ formatDateOnly(diaryReportData.generatedAt) }}</p>
                  <p><span class="font-medium">Patient ID:</span> {{ patientId }}</p>
                  <p class="mt-2 text-xs">This report contains a comprehensive summary of the patient's assessment history and progress tracking.</p>
                </div>
              </div>
            </div>
            
            <div v-else class="text-gray-400 text-center py-8">
              <Icon name="material-symbols:description" size="48" class="mx-auto mb-4 text-gray-300" />
              <p>No diary report data available.</p>
              <p class="text-sm mt-2">Click "Generate Report" to create a comprehensive patient diary report.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.text-primary {
  color: #3b82f6; /* Tailwind blue-500 as primary */
}
.border-primary {
  border-color: #3b82f6;
}
</style>
