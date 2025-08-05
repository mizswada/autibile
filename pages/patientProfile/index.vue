<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import { jsPDF } from 'jspdf';

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

const router = useRouter();
const toast = useToast();

const tabMap = {
  'Patient Details': 'patient-details',
  'Parent Details': 'parent-details',
  'Appointments': 'appointments',
  'Questionnaires': 'questionnaires',
  'Doctor Referrals': 'doctor-referrals'
};
const reverseTabMap = Object.fromEntries(Object.entries(tabMap).map(([k, v]) => [v, k]));

// Set activeTab from query param on mount
onMounted(async () => {
  if (route.query.tab && reverseTabMap[route.query.tab]) {
    activeTab.value = reverseTabMap[route.query.tab];
  }
  if (!patientId.value) {
    error.value = 'No patient ID provided';
    isLoading.value = false;
    return;
  }
  await loadAllData();
});

// Watch for changes in the route query
watch(() => route.query.tab, (newTab) => {
  if (newTab && reverseTabMap[newTab]) {
    activeTab.value = reverseTabMap[newTab];
  }
});

// When tab changes, update the route query
watch(activeTab, (newTab) => {
  const tabQuery = tabMap[newTab];
  if (tabQuery && route.query.tab !== tabQuery) {
    router.replace({
      query: { ...route.query, tab: tabQuery }
    });
  }
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
      toast.success('Referral deleted successfully');
    } else {
      deleteError.value = result.message || 'Failed to delete referral.';
      toast.error(deleteError.value);
    }
  } catch (err) {
    deleteError.value = err?.message || 'Failed to delete referral.';
    toast.error(deleteError.value);
  } finally {
    deleteLoading.value = false;
  }
}
function downloadReferralPdf(referral) {
  // Implement PDF download logic or call existing function
  alert('Download PDF for referral ' + referral.id);
}

async function downloadReferralLetter(referral) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const W = pdf.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  // — Header with clinic name and logo
  pdf.setFontSize(16).setFont(undefined, 'bold');
  pdf.text('NEUROSPA AUTISM CENTRE', margin, y);
  y += 8;
  pdf.setFontSize(10).setFont(undefined, 'normal');
  pdf.text('Tel   : +60 3-1234 5678', margin, y);
  y += 4;
  pdf.text('SAMB : +60 3-1234 5679', margin, y);

  // — Divider
  y += 10;
  pdf.setLineWidth(0.5).line(margin, y, W - margin, y);

  // — Date
  y += 8;
  pdf.setFontSize(11).setFont(undefined, 'normal');
  const dateStr = referral.date ? formatDateOnly(referral.date) : formatDateOnly(new Date().toISOString());
  pdf.text(`Date : ${dateStr}`, W - margin, y, { align: 'right' });

  // — Referral to & salutation
  y += 15;
  pdf.setFont(undefined, 'normal');
  pdf.text('Referral to:', margin, y);
  pdf.text(referral.recipient || '__________', margin + 30, y);

  y += 10;
  pdf.text('Dear ' + (referral.recipient || '__________') + ',', margin, y);

  // — Reason for Referral
  y += 15;
  pdf.setFont(undefined, 'bold').setFontSize(11);
  pdf.text('REASON FOR REFERRAL :', margin, y);
  pdf.setFont(undefined, 'normal');
  pdf.text(referral.reason || '________________', margin + 50, y); 

  // — Patient's details
  y += 15;
  pdf.setFont(undefined, 'bold').setFontSize(11);
  pdf.text('Patient\'s details:', margin, y);

  // draw fields
  const details = [
    ['Name',        patientDetails.value?.fullname || 'NA'],
    ['DOB',         formatDateOnly(patientDetails.value?.dob) || 'NA'],
    ['Age',         calculateAge(patientDetails.value?.dob) || 'NA'],
  ];
  y += 8;
  pdf.setFont(undefined, 'normal').setFontSize(10);
  details.forEach(([label, val]) => {
    pdf.text(label + ' :', margin + 5, y);
    pdf.text(val, margin + 50, y);
    y += 7;
  });

  // — Diagnosis
  if (referral.diagnosis?.length) {
    y += 4;
    pdf.setFont(undefined, 'bold').setFontSize(11);
    pdf.text('Diagnosis:', margin, y);
    y += 7;
    pdf.setFont(undefined, 'normal').setFontSize(10);
    referral.diagnosis.forEach((d, i) => {
      pdf.text(`${i + 1}. ${d}`, margin + 5, y);
      y += 6;
    });
  }

  // — Thank-you
  y += 8;
  pdf.setFont(undefined, 'normal').setFontSize(10);
  pdf.text('Thank you for seeing the above-named child.', margin, y);

  // — History fields
  const hist = referral.history || {};
  const historyLabels = [
    'Presenting concerns',
    'Developmental milestones',
    'Behavioural concerns',
    'Medical history',
    'Medication / Allergies',
    'Family / social background',
    'Other relevant history'
  ];
  y += 12;
  pdf.setFont(undefined, 'normal').setFontSize(10);
  historyLabels.forEach(label => {
    const key = label.toLowerCase().replace(/[ /]/g, '');
    const val = hist[key] || 'NA';
    pdf.text(`${label}:`, margin, y);
    pdf.text(val, margin + 60, y);
    y += 7;
  });

  // — Exams
  y += 4;
  pdf.text('Physical examination:', margin, y);
  pdf.text(referral.physicalExamination || 'NA', margin + 60, y);
  y += 7;
  pdf.text('General appearance:', margin, y);
  pdf.text(referral.generalAppearance || 'NA', margin + 60, y);
  y += 7;
  pdf.text('Systemic examination:', margin, y);
  pdf.text(
    (referral.systemicExamination || []).join(', ') || 'NA',
    margin + 60,
    y
  );

  // — Medications
  y += 10;
  pdf.text('Current medications:', margin, y);
  pdf.text(referral.currentMedications, margin + 60, y);
  if (referral.currentMedications === 'Yes') {
    y += 7;
    pdf.text('Details:', margin, y);
    pdf.text(referral.medicationDetails || 'NA', margin + 60, y);
  }

  // — Closing & signature
  y = pdf.internal.pageSize.getHeight() - 50;
  pdf.text('Please kindly see him/her to provide your expert assessment and management.', margin, y - 20);
  pdf.text('Thank you.', margin, y - 10);
  pdf.text('Yours sincerely,', margin, y);
  pdf.text('__________________________', margin, y + 10);
  pdf.text('Referring personnel', margin, y + 18);

  // — Download
  pdf.save(`referral_${dateStr.replace(/[/ ]/g, '_')}.pdf`);
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
                        <td class="px-6 py-4 text-sm text-gray-900">{{ referral.recipient || referral.referrals_recepient }}</td>
                        <td class="px-6 py-4 text-sm text-gray-900">{{ formatDateOnly(referral.date || referral.referrals_date) }}</td>
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
                            <rs-button variant="outline" size="sm" @click="downloadReferralLetter(referral)">
                              <Icon name="material-symbols:download" size="16" />
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
                      <p class="text-gray-900">{{ formatDateOnly(selectedReferral.date || selectedReferral.referrals_date) }}</p>
                    </div>
                    <div>
                      <span class="text-sm font-medium text-gray-500">Recipient:</span>
                      <p class="text-gray-900">{{ selectedReferral.recipient || selectedReferral.referrals_recepient }}</p>
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
