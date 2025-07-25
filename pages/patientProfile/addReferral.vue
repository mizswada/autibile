<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();
const patientId = computed(() => route.query.patientId || route.params.id);
const referralId = computed(() => route.query.referralId);
const isEdit = computed(() => !!referralId.value);
const fetchLoading = ref(false);

const isLoading = ref(false);
const error = ref(null);

// Form fields (copy structure from your main referrals form)
const recipientOptions = [
  'Consultant Paediatrician',
  'Developmental Paediatrician',
  'Speech-Language Therapist',
  'Occupational Therapist',
  'Clinical Psychologist',
  'Child Psychiatrist',
  'Physiotherapist',
  'Educational Psychologist',
  'Dietitian',
  'Social Worker',
  'Other'
];
const reasonOptions = [
  'Assessment and intervention for speech and language delay',
  'Behavioural management',
  'Sensory integration therapy',
  'Feeding difficulties',
  'Occupational therapy for motor skills',
  'Evaluation of sleep problems',
  'Social skills training',
  'Psychological assessment',
  'Nutritional concerns',
  'Special education support',
  'Others'
];
const systemicOptions = [
  'Cardiovascular',
  'Respiratory',
  'Abdomen',
  'Neurology',
  'Other'
];

const referralForm = ref({
  recipient: '',
  customRecipient: '',
  hospital: '',
  date: new Date().toISOString().slice(0, 10),
  diagnosis: [],
  reason: '',
  customReason: '',
  notes: '',
  history: {
    presentingConcerns: '',
    developmentalMilestone: '',
    behavioralConcerns: '',
    medicalHistory: '',
    medicationAllergies: '',
    familySocialBackground: '',
    otherHistory: ''
  },
  physicalExamination: '',
  generalAppearance: '',
  systemicExamination: [],
  customSystemic: '',
  currentMedications: 'No',
  medicationDetails: ''
});
const diagnosisInput = ref('');

onMounted(async () => {
  if (isEdit.value) {
    fetchLoading.value = true;
    try {
      const res = await fetch(`/api/patientProfile/referrals?id=${referralId.value}`);
      const result = await res.json();
      if (result.statusCode === 200 && result.data) {
        // Pre-fill the form
        const r = result.data;
        referralForm.value = {
          recipient: recipientOptions.includes(r.recipient) ? r.recipient : 'Other',
          customRecipient: recipientOptions.includes(r.recipient) ? '' : r.recipient,
          hospital: r.hospital,
          date: r.date,
          diagnosis: Array.isArray(r.diagnosis) ? r.diagnosis : [],
          reason: reasonOptions.includes(r.reason) ? r.reason : 'Others',
          customReason: reasonOptions.includes(r.reason) ? '' : r.reason,
          notes: r.notes,
          history: r.history || {
            presentingConcerns: '',
            developmentalMilestone: '',
            behavioralConcerns: '',
            medicalHistory: '',
            medicationAllergies: '',
            familySocialBackground: '',
            otherHistory: ''
          },
          physicalExamination: r.physicalExamination || '',
          generalAppearance: r.generalAppearance || '',
          systemicExamination: Array.isArray(r.systemicExamination)
            ? r.systemicExamination.map(opt => systemicOptions.includes(opt) ? opt : 'Other')
            : [],
          customSystemic: Array.isArray(r.systemicExamination)
            ? r.systemicExamination.find(opt => !systemicOptions.includes(opt)) || ''
            : '',
          currentMedications: r.currentMedications || 'No',
          medicationDetails: r.medicationDetails || ''
        };
      } else {
        error.value = result.message || 'Failed to load referral.';
      }
    } catch (err) {
      error.value = err?.message || 'Failed to load referral.';
    } finally {
      fetchLoading.value = false;
    }
  }
});

function addDiagnosis() {
  const val = diagnosisInput.value.trim();
  if (val && !referralForm.value.diagnosis.includes(val)) {
    referralForm.value.diagnosis.push(val);
    diagnosisInput.value = '';
  }
}
function removeDiagnosis(idx) {
  referralForm.value.diagnosis.splice(idx, 1);
}

async function saveReferral() {
  isLoading.value = true;
  error.value = null;
  try {
    const recipientValue = referralForm.value.recipient === 'Other'
      ? referralForm.value.customRecipient
      : referralForm.value.recipient;
    const reasonValue = referralForm.value.reason === 'Others'
      ? referralForm.value.customReason
      : referralForm.value.reason;
    const systemicValue = referralForm.value.systemicExamination.map(opt =>
      opt === 'Other' ? referralForm.value.customSystemic : opt
    );

    let response, result;
    if (isEdit.value) {
      response = await fetch(`/api/patientProfile/referrals?id=${referralId.value}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: parseInt(patientId.value),
          recipient: recipientValue,
          hospital: referralForm.value.hospital,
          date: referralForm.value.date,
          diagnosis: referralForm.value.diagnosis,
          reason: reasonValue,
          notes: referralForm.value.notes,
          history: referralForm.value.history,
          physicalExamination: referralForm.value.physicalExamination,
          generalAppearance: referralForm.value.generalAppearance,
          systemicExamination: systemicValue,
          currentMedications: referralForm.value.currentMedications,
          medicationDetails: referralForm.value.currentMedications === 'Yes' ? referralForm.value.medicationDetails : ''
        })
      });
      result = await response.json();
      if (result.statusCode === 200) {
        router.push({ path: '/patientProfile', query: { patientId: patientId.value } });
      } else {
        error.value = result.message || 'Failed to update referral';
      }
    } else {
      response = await fetch('/api/patientProfile/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: parseInt(patientId.value),
          recipient: recipientValue,
          hospital: referralForm.value.hospital,
          date: referralForm.value.date,
          diagnosis: referralForm.value.diagnosis,
          reason: reasonValue,
          notes: referralForm.value.notes,
          history: referralForm.value.history,
          physicalExamination: referralForm.value.physicalExamination,
          generalAppearance: referralForm.value.generalAppearance,
          systemicExamination: systemicValue,
          currentMedications: referralForm.value.currentMedications,
          medicationDetails: referralForm.value.currentMedications === 'Yes' ? referralForm.value.medicationDetails : ''
        })
      });
      result = await response.json();
      if (result.statusCode === 201) {
        router.push({ path: '/patientProfile', query: { patientId: patientId.value } });
      } else {
        error.value = result.message || 'Failed to save referral';
      }
    }
  } catch (err) {
    error.value = err?.message || 'Failed to save referral';
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto">
    <h1 class="text-2xl font-bold mb-4">{{ isEdit ? 'Edit Referral' : 'Add Referral' }}</h1>
    <div v-if="error" class="bg-red-100 text-red-700 p-3 rounded mb-4">{{ error }}</div>
    <div v-if="fetchLoading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      <span class="ml-3 text-gray-600">Loading referral...</span>
    </div>
    <div v-else class="bg-white rounded-lg shadow p-6">
      <form @submit.prevent="saveReferral" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Recipient *</label>
          <select v-model="referralForm.recipient" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
            <option value="" disabled>Select recipient</option>
            <option v-for="option in recipientOptions" :key="option" :value="option">{{ option }}</option>
          </select>
          <div v-if="referralForm.recipient === 'Other'" class="mt-2">
            <input v-model="referralForm.customRecipient" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Enter recipient" required />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Hospital/Clinic *</label>
          <input v-model="referralForm.hospital" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-md" required />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Referral Date *</label>
          <input v-model="referralForm.date" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-md" required />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
          <div class="flex flex-wrap gap-2 mb-2">
            <span v-for="(diag, idx) in referralForm.diagnosis" :key="idx" class="inline-flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
              {{ diag }}
              <button type="button" class="ml-1 text-blue-500 hover:text-blue-700" @click="removeDiagnosis(idx)">&times;</button>
            </span>
          </div>
          <div class="flex">
            <input v-model="diagnosisInput" type="text" class="flex-1 px-3 py-2 border border-gray-300 rounded-md" placeholder="Add diagnosis and press Enter" @keyup.enter="addDiagnosis" />
            <button type="button" class="ml-2 px-3 py-2 bg-blue-600 text-white rounded" @click="addDiagnosis">Add</button>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Reason for Referral *</label>
          <select v-model="referralForm.reason" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
            <option value="" disabled>Select reason</option>
            <option v-for="option in reasonOptions" :key="option" :value="option">{{ option === 'Others' ? 'Others' : option }}</option>
          </select>
          <div v-if="referralForm.reason === 'Others'" class="mt-2">
            <input v-model="referralForm.customReason" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Enter reason" required />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-3">History</label>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-400 mb-1">Presenting Concerns (or NA)</label>
            <input v-model="referralForm.history.presentingConcerns" type="textarea" class="w-full px-3 py-2 border border-gray-300 rounded-md" />
            <label class="block text-sm font-medium text-gray-400 mb-1">Developmental Milestone (or NA)</label>
            <input v-model="referralForm.history.developmentalMilestone" type="textarea" class="w-full px-3 py-2 border border-gray-300 rounded-md" />
            <label class="block text-sm font-medium text-gray-400 mb-1">Behavioral Concerns (or NA)</label>
            <input v-model="referralForm.history.behavioralConcerns" type="textarea" class="w-full px-3 py-2 border border-gray-300 rounded-md" />
            <label class="block text-sm font-medium text-gray-400 mb-1">Medical History (or NA)</label>
            <input v-model="referralForm.history.medicalHistory" type="textarea" class="w-full px-3 py-2 border border-gray-300 rounded-md" />
            <label class="block text-sm font-medium text-gray-400 mb-1">Medication/Allergies (or NA)</label>
            <input v-model="referralForm.history.medicationAllergies" type="textarea" class="w-full px-3 py-2 border border-gray-300 rounded-md" />
            <label class="block text-sm font-medium text-gray-400 mb-1">Family/Social Background (or NA) </label>
            <input v-model="referralForm.history.familySocialBackground" type="textarea" class="w-full px-3 py-2 border border-gray-300 rounded-md" />
            <label class="block text-sm font-medium text-gray-400 mb-1">Other Relevant History (or NA)</label>
            <input v-model="referralForm.history.otherHistory" type="textarea" class="w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Physical Examination (Optional)</label>
          <textarea v-model="referralForm.physicalExamination" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Physical examination findings (or NA)"></textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">General Appearance</label>
          <textarea v-model="referralForm.generalAppearance" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="General appearance (or NA)"></textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Systemic Examination</label>
          <div class="flex flex-wrap gap-2 mb-2">
            <label v-for="option in systemicOptions" :key="option" class="flex items-center space-x-2">
              <input type="checkbox" :value="option" v-model="referralForm.systemicExamination" />
              <span>{{ option }}</span>
            </label>
          </div>
          <div v-if="referralForm.systemicExamination.includes('Other')" class="mt-2">
            <input v-model="referralForm.customSystemic" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Specify other system" />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Current Medications</label>
          <select v-model="referralForm.currentMedications" class="w-full px-3 py-2 border border-gray-300 rounded-md">
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
          <div v-if="referralForm.currentMedications === 'Yes'" class="mt-2">
            <input v-model="referralForm.medicationDetails" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Specify name and dose" />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea v-model="referralForm.notes" rows="4" class="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Additional notes, observations, or recommendations..."></textarea>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="px-4 py-2 bg-gray-200 rounded" @click="router.back()">Cancel</button>
          <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded" :disabled="isLoading">
            {{ isLoading ? 'Saving...' : (isEdit ? 'Save Changes' : 'Save Referral') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
