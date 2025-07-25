<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

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
const showReferralModal = ref(false);
const selectedReferral = ref(null);
const deleteLoading = ref(false);
const deleteError = ref(null);

// Data
const patientDetails = ref(null);
const parentDetails = ref(null);
const appointments = ref([]);
const questionnaires = ref([]);
const doctorReferrals = ref([]);
const collapsedQnA = ref({});
const scoreThresholds = ref({});
const thresholdsLoading = ref(false);

// Tabs
const tabs = [
  'Patient Details',
  'Parent Details',
  'Appointments',
  'Questionnaires',
  'Doctor Referrals'
];

const router = useRouter();

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
      fetchDoctorReferrals()
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
  const res = await fetch(`/api/appointments/list?patient_id=${patientId.value}`);
  const data = await res.json();
  if (data.success) appointments.value = data.data;
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

// Add these methods for actions (can be stubs or use existing logic)
function openReferralModal(referral) {
  selectedReferral.value = referral;
  showReferralModal.value = true;
}
function closeReferralModal() {
  showReferralModal.value = false;
  selectedReferral.value = null;
}
function editReferral(referral) {
  console.log('Edit referral:', referral);
  router.push({ path: '/patientProfile/addReferral', query: { patientId: patientId.value, referralId: referral.id } });
}
async function deleteReferral(referralId) {
  if (!window.confirm('Are you sure you want to delete this referral?')) return;
  deleteLoading.value = true;
  deleteError.value = null;
  try {
    const res = await fetch(`/api/patientProfile/referrals?id=${referralId}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.statusCode === 200) {
      // Remove from local list
      doctorReferrals.value = doctorReferrals.value.filter(r => r.id !== referralId);
      // If modal is open for this referral, close it
      if (selectedReferral.value && selectedReferral.value.id === referralId) {
        closeReferralModal();
      }
    } else {
      deleteError.value = result.message || 'Failed to delete referral.';
    }
  } catch (err) {
    deleteError.value = err?.message || 'Failed to delete referral.';
  } finally {
    deleteLoading.value = false;
  }
}
function downloadReferralPdf(referral) {
  // Implement PDF download logic or call existing function
  alert('Download PDF for referral ' + referral.id);
}
</script>

<template>
  <div class="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
    <div class="flex items-center justify-between mb-8">
      <h1 class="text-3xl font-bold">Patient Profile</h1>
      <rs-button variant="outline" @click="$router.go(-1)">
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
            <ul v-if="appointments && appointments.length" class="space-y-4">
              <li
                v-for="appt in appointments"
                :key="appt.appointment_id || appt.id"
                class="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <!-- Main Appointment Info -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  <div>
                    <span class="font-medium text-gray-700">Patient:</span>
                    <p class="text-gray-900">{{ getPatientName(appt) }}</p>
                  </div>
                  <div>
                    <span class="font-medium text-gray-700">Practitioner:</span>
                    <p class="text-gray-900">{{ getPractitionerName(appt) }}</p>
                  </div>
                  <div>
                    <span class="font-medium text-gray-700">Service:</span>
                    <p class="text-gray-900">{{ getServiceName(appt) }}</p>
                  </div>
                  <div>
                    <span class="font-medium text-gray-700">Date:</span>
                    <p class="text-gray-900">{{ new Date(appt.start || appt.date).toLocaleDateString() }}</p>
                  </div>
                  <div>
                    <span class="font-medium text-gray-700">Time:</span>
                    <p class="text-gray-900">{{ getTimeSlot(appt) }}</p>
                  </div>
                  <div>
                    <span class="font-medium text-gray-700">Status:</span>
                    <p class="text-gray-900">
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
                    </p>
                  </div>
                  <div>
                    <span class="font-medium text-gray-700">Session Number:</span>
                    <p class="text-gray-900">{{ getSessionNumber(appt) }}</p>
                  </div>
                </div>

                <!-- Comments and Rating Section -->
                <div class="border-t pt-4 space-y-3">
                  <!-- Parent Comment -->
                  <div v-if="getParentComment(appt)">
                    <span class="font-medium text-gray-700">Parent Comment:</span>
                    <p class="text-gray-900 mt-1 p-2 bg-gray-50 rounded">{{ getParentComment(appt) }}</p>
                  </div>

                  <!-- Parent Rating -->
                  <div v-if="getParentRate(appt)">
                    <span class="font-medium text-gray-700">Parent Rating:</span>
                    <div class="mt-1 p-2 bg-gray-50 rounded flex items-center">
                      <div class="flex">
                        <Icon 
                          v-for="i in 5" 
                          :key="i" 
                          :name="i <= Number(getParentRate(appt)) ? 'material-symbols:star' : 'material-symbols:star-outline'" 
                          class="text-yellow-500" 
                          size="20" 
                        />
                      </div>
                      <span class="ml-2 text-sm">{{ Number(getParentRate(appt)) }} / 5</span>
                    </div>
                  </div>

                  <!-- Therapist/Doctor Comment -->
                  <div v-if="getTherapistDoctorComment(appt)">
                    <span class="font-medium text-gray-700">Practitioner Comment:</span>
                    <p class="text-gray-900 mt-1 p-2 bg-gray-50 rounded">{{ getTherapistDoctorComment(appt) }}</p>
                  </div>
                </div>
              </li>
            </ul>
            <div v-else class="text-gray-400">No appointments found.</div>
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
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Detailed Answers for each questionnaire -->
              <div v-for="q in questionnaires" :key="'detail-'+q.qr_id" class="border rounded-lg overflow-hidden">
                <div class="bg-white px-4 py-2 border-b">
                  <h4 class="font-medium text-lg">{{ q.questionnaire_title || 'Assessment' }}</h4>
                  <p class="text-sm text-gray-600">Completed on {{ new Date(q.created_at).toLocaleDateString() }}</p>
                </div>
                
                <div class="p-4">
                  <!-- Score and Level -->
                  <div class="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div class="flex items-center justify-between">
                      <div>
                        <span class="font-medium">Total Score:</span>
                        <span class="ml-2 text-lg font-bold" :class="getScoreClass(q.total_score)">
                          {{ displayScore(q.total_score) }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Questions and Answers -->
                  <div v-if="q.answers && q.answers.length > 0" class="space-y-4">
                    <h5 @click="toggleQnA(q.qr_id)" class="flex items-center cursor-pointer select-none">
                      Questions & Answers
                      <Icon :name="collapsedQnA[q.qr_id] ? 'material-symbols:expand-less' : 'material-symbols:expand-more'" class="ml-2" />
                    </h5>
                    <div v-show="collapsedQnA[q.qr_id]" class="space-y-4">
                      <div v-for="(answer, answerIndex) in q.answers" :key="answerIndex" class="border rounded p-3 hover:bg-gray-50">
                        <div class="mb-2">
                          <span class="font-medium text-gray-700">Q{{ answerIndex + 1 }}:</span>
                          <span class="ml-2">{{ answer.question_text || 'Question' }}</span>
                          <span v-if="answer.question_text_bm" class="block text-sm text-gray-500 italic mt-1">
                            {{ answer.question_text_bm }}
                          </span>
                        </div>
                        
                        <div class="ml-4">
                          <div v-if="answer.text_answer" class="text-sm">
                            <span class="font-medium text-gray-600">Answer:</span>
                            <span class="ml-2">{{ answer.text_answer }}</span>
                          </div>
                          <div v-else-if="answer.option_title" class="text-sm">
                            <span class="font-medium text-gray-600">Selected:</span>
                            <span class="ml-2">{{ answer.option_title }}</span>
                          </div>
                          <div v-else class="text-sm text-gray-500 italic">
                            No answer provided
                          </div>
                          
                          <div v-if="answer.score !== undefined && answer.score !== null" class="text-sm mt-1">
                            <span class="font-medium text-gray-600">Score:</span>
                            <span class="ml-2">{{ displayScore(answer.score) }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-else class="text-gray-500 italic text-center py-4">
                    No detailed answers available
                  </div>

                  <!-- Recommendation -->
                  <div class="mt-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                    <h6 class="font-medium text-blue-800 mb-1">Recommendation</h6>
                    <p class="text-sm text-blue-700">
                      {{ getScoreInterpretation(q)?.recommendation || '-' }}
                    </p>
                  </div>
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
                @click="$router.push(`/patientProfile/addReferral?patientId=${patientId}`)"
              >
                <Icon name="material-symbols:add" class="mr-1" />
                Add Referral
              </rs-button>
            </div>

            <!-- Loading State -->
            <div v-if="isLoading" class="flex justify-center items-center py-12">
              <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              <span class="ml-3 text-gray-600">Loading referrals...</span>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <Icon name="material-symbols:error-outline" size="48" class="text-red-400 mx-auto mb-4" />
              <h3 class="text-lg font-medium text-red-800 mb-2">Error Loading Referrals</h3>
              <p class="text-red-600">{{ error }}</p>
            </div>

            <!-- Referrals Table -->
            <div v-else>
              <div v-if="doctorReferrals.length === 0" class="text-center py-12">
                <Icon name="material-symbols:medical-services" size="64" class="mx-auto mb-4 text-gray-300" />
                <h3 class="text-lg font-medium text-gray-600 mb-2">No Referrals Found</h3>
                <p class="text-gray-500">Start by adding a new doctor referral for this patient.</p>
                <rs-button 
                  variant="primary" 
                  class="mt-4"
                  @click="$router.push(`/patientProfile/addReferral?patientId=${patientId}`)"
                >
                  <Icon name="material-symbols:add" class="mr-1" />
                  Add First Referral
                </rs-button>
              </div>
              <div v-else>
                <div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                      <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hospital</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recipient</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                      <tr v-for="referral in doctorReferrals" :key="referral.id" class="hover:bg-purple-50">
                        <td class="px-6 py-4 text-sm text-gray-900">{{ referral.hospital }}</td>
                        <td class="px-6 py-4 text-sm text-gray-900">{{ referral.recipient || referral.doctorName }}</td>
                        <td class="px-6 py-4 text-sm text-gray-900">{{ formatDateOnly(referral.date) }}</td>
                        <td class="px-6 py-4 text-sm text-gray-900">
                          <div class="flex space-x-2">
                            <rs-button variant="outline" size="sm" @click="openReferralModal(referral)">
                              <Icon name="material-symbols:visibility" size="16" />
                            </rs-button>
                            <rs-button variant="outline" size="sm" @click="editReferral(referral)">
                              <Icon name="material-symbols:edit" size="16" />
                            </rs-button>
                            <rs-button variant="outline" size="sm" @click="deleteReferral(referral.id)">
                              <Icon name="material-symbols:delete" size="16" class="text-red-500" />
                            </rs-button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Referral Details Modal -->
            <rs-modal v-model="showReferralModal" title="Referral Details" size="lg">
              <div v-if="selectedReferral">
                <div class="mb-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <span class="text-sm font-medium text-gray-500">Hospital:</span>
                      <p class="text-gray-900">{{ selectedReferral.hospital }}</p>
                    </div>
                    <div>
                      <span class="text-sm font-medium text-gray-500">Referral Date:</span>
                      <p class="text-gray-900">{{ formatDateOnly(selectedReferral.date) }}</p>
                    </div>
                    <div>
                      <span class="text-sm font-medium text-gray-500">Recipient:</span>
                      <p class="text-gray-900">{{ selectedReferral.recipient || selectedReferral.doctorName }}</p>
                    </div>
                    <div>
                      <span class="text-sm font-medium text-gray-500">Diagnosis:</span>
                      <div>
                        <span
                          v-for="(diag, idx) in (Array.isArray(selectedReferral.diagnosis) ? selectedReferral.diagnosis : [])"
                          :key="idx"
                          class="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded mr-1 mb-1 text-xs"
                        >{{ diag }}</span>
                      </div>
                    </div>
                    <div>
                      <span class="text-sm font-medium text-gray-500">Reason for Referral:</span>
                      <p class="text-gray-900">{{ selectedReferral.reason }}</p>
                    </div>
                    <div>
                      <span class="text-sm font-medium text-gray-500">History:</span>
                      <ul class="text-gray-900 text-sm list-disc ml-4">
                        <li><strong>Presenting Concerns:</strong> {{ (selectedReferral.history || {}).presentingConcerns || 'NA' }}</li>
                        <li><strong>Developmental Milestone:</strong> {{ (selectedReferral.history || {}).developmentalMilestone || 'NA' }}</li>
                        <li><strong>Behavioral Concerns:</strong> {{ (selectedReferral.history || {}).behavioralConcerns || 'NA' }}</li>
                        <li><strong>Medical History:</strong> {{ (selectedReferral.history || {}).medicalHistory || 'NA' }}</li>
                        <li><strong>Medication/Allergies:</strong> {{ (selectedReferral.history || {}).medicationAllergies || 'NA' }}</li>
                        <li><strong>Family/Social Background:</strong> {{ (selectedReferral.history || {}).familySocialBackground || 'NA' }}</li>
                        <li><strong>Other Relevant History:</strong> {{ (selectedReferral.history || {}).otherHistory || 'NA' }}</li>
                      </ul>
                    </div>
                    <div>
                      <span class="text-sm font-medium text-gray-500">Physical Examination:</span>
                      <p class="text-gray-900">{{ selectedReferral.physicalExamination || 'NA' }}</p>
                    </div>
                    <div>
                      <span class="text-sm font-medium text-gray-500">General Appearance:</span>
                      <p class="text-gray-900">{{ selectedReferral.generalAppearance || 'NA' }}</p>
                    </div>
                    <div>
                      <span class="text-sm font-medium text-gray-500">Systemic Examination:</span>
                      <div>
                        <span
                          v-for="(sys, idx) in (Array.isArray(selectedReferral.systemicExamination) ? selectedReferral.systemicExamination : [])"
                          :key="idx"
                          class="inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded mr-1 mb-1 text-xs"
                        >{{ sys }}</span>
                      </div>
                    </div>
                    <div>
                      <span class="text-sm font-medium text-gray-500">Current Medications:</span>
                      <span class="text-gray-900">{{ selectedReferral.currentMedications }}</span>
                      <div v-if="selectedReferral.currentMedications === 'Yes'">
                        <span class="text-sm font-medium text-gray-500">Details:</span>
                        <p class="text-gray-900">{{ selectedReferral.medicationDetails }}</p>
                      </div>
                    </div>
                  </div>
                  <div v-if="selectedReferral.notes">
                    <span class="text-sm font-medium text-gray-500">Notes:</span>
                    <p class="text-gray-700 mt-1 bg-gray-50 p-3 rounded">{{ selectedReferral.notes }}</p>
                  </div>
                  <div v-if="deleteError" class="bg-red-100 text-red-700 p-2 rounded mb-2">{{ deleteError }}</div>
                </div>
                <div class="flex justify-end space-x-2 mt-4">
                  <rs-button variant="primary" @click="editReferral(selectedReferral)">
                    <Icon name="material-symbols:edit" class="mr-1" /> Edit
                  </rs-button>
                  <rs-button variant="danger" :disabled="deleteLoading" @click="deleteReferral(selectedReferral.id)">
                    <Icon name="material-symbols:delete" class="mr-1" />
                    <span v-if="deleteLoading">Deleting...</span>
                    <span v-else>Delete</span>
                  </rs-button>
                  <rs-button variant="outline" @click="closeReferralModal">
                    Close
                  </rs-button>
                </div>
              </div>
            </rs-modal>
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
