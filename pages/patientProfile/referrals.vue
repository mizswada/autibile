<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import jsPDF from 'jspdf';

const route = useRoute();
const patientId = computed(() => route.query.patientId || route.params.id);

// Data
const referrals = ref([]);
const isLoading = ref(true);
const error = ref(null);
const showAddModal = ref(false);
const selectedReferral = ref(null);

// Recipient options
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

// Reason options
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

// Systemic examination options
const systemicOptions = [
  'Cardiovascular',
  'Respiratory',
  'Abdomen',
  'Neurology',
  'Other'
];

// Form data
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
  if (patientId.value) {
    await fetchReferrals();
  } else {
    error.value = 'No patient ID provided';
    isLoading.value = false;
  }
});

async function fetchReferrals() {
  isLoading.value = true;
  error.value = null;
  
  try {
    const response = await fetch(`/api/patientProfile/referrals?patientId=${patientId.value}`);
    const result = await response.json();
    
    if (result.statusCode === 200 && result.data) {
      referrals.value = result.data;
    } else {
      referrals.value = [];
    }
  } catch (err) {
    console.error('Error fetching referrals:', err);
    referrals.value = [];
  } finally {
    isLoading.value = false;
  }
}

function openAddModal() {
  showAddModal.value = true;
  referralForm.value = {
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
  };
  diagnosisInput.value = '';
}

function closeAddModal() {
  showAddModal.value = false;
  selectedReferral.value = null;
}

async function saveReferral() {
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

    // Prepare payload
    const payload = {
      id: selectedReferral.value.id,
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
    };

    let response, result;
    if (selectedReferral.value && selectedReferral.value.id) {
      // Edit mode: PUT
      payload.id = selectedReferral.value.id;
      response = await fetch('/api/patientProfile/referrals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      result = await response.json();
      if (result.statusCode === 200) {
        // Update the referral in the list
        const idx = referrals.value.findIndex(r => r.id === payload.id);
        if (idx !== -1) referrals.value[idx] = result.data;
        closeAddModal();
      } else {
        console.error('Error updating referral:', result.message);
      }
    } else {
      // Create mode: POST
      response = await fetch('/api/patientProfile/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      result = await response.json();
      if (result.statusCode === 201) {
        referrals.value.unshift(result.data);
        closeAddModal();
      } else {
        console.error('Error saving referral:', result.message);
      }
    }
  } catch (err) {
    console.error('Error saving referral:', err);
  }
}

function editReferral(referral) {
  selectedReferral.value = referral;
  referralForm.value = {
    recipient: recipientOptions.includes(referral.recipient) ? referral.recipient : 'Other',
    customRecipient: recipientOptions.includes(referral.recipient) ? '' : referral.recipient,
    hospital: referral.hospital,
    date: referral.date,
    diagnosis: Array.isArray(referral.diagnosis) ? referral.diagnosis : [],
    reason: reasonOptions.includes(referral.reason) ? referral.reason : 'Others',
    customReason: reasonOptions.includes(referral.reason) ? '' : referral.reason,
    notes: referral.notes,
    history: referral.history || {
      presentingConcerns: '',
      developmentalMilestone: '',
      behavioralConcerns: '',
      medicalHistory: '',
      medicationAllergies: '',
      familySocialBackground: '',
      otherHistory: ''
    },
    physicalExamination: referral.physicalExamination || '',
    generalAppearance: referral.generalAppearance || '',
    systemicExamination: Array.isArray(referral.systemicExamination)
      ? referral.systemicExamination.map(opt => systemicOptions.includes(opt) ? opt : 'Other')
      : [],
    customSystemic: Array.isArray(referral.systemicExamination)
      ? referral.systemicExamination.find(opt => !systemicOptions.includes(opt)) || ''
      : '',
    currentMedications: referral.currentMedications || 'No',
    medicationDetails: referral.medicationDetails || ''
  };
  diagnosisInput.value = '';
  showAddModal.value = true;
}

function deleteReferral(referralId) {
  if (confirm('Are you sure you want to delete this referral?')) {
    referrals.value = referrals.value.filter(r => r.id !== referralId);
  }
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

// Diagnosis tag management
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

// PDF download for a single referral
function downloadReferralPdf(referral) {
  const doc = new jsPDF();
  let y = 10;
  doc.setFontSize(16);
  doc.text('Patient Referral', 10, y);
  y += 10;

  // 1) Logo (replace 'logoImg' with your DataURL or imported image)
  // doc.addImage(neuroSpa, 'JPG', margin, y, 100, 40);
  
   //2) Header contact info
  //doc.setFont('helvetica', 'bold').setFontSize(12);
  //doc.text('Artificial Intelligence Sdn Bhd', margin + 110, y + 12);
  //doc.setFont('helvetica', 'normal').setFontSize(10);
  //doc.text('Tel: 03-1234 5678    SAMB: 603-1234 5678', margin + 110, y + 30);

  //3) Divider line
  //y += 60;
  //doc.setLineWidth(0.5).line(margin, y, pageWidth - margin, y);

  // 4) Date, right-aligned
  //const dateStr = `Date: ${formatDate(referral.date)}`;
  //doc.setFontSize(10);
  //const dateWidth = doc.getTextWidth(dateStr);
  //doc.text(dateStr, pageWidth - margin - dateWidth, y - 5);

  doc.setFontSize(12);
  doc.text(`Recipient: ${referral.recipient}`, 10, y); y += 8;
  doc.text(`Hospital: ${referral.hospital}`, 10, y); y += 8;
  doc.text(`Referral Date: ${formatDate(referral.date)}`, 10, y); y += 8;
  doc.text(`Diagnosis: ${Array.isArray(referral.diagnosis) ? referral.diagnosis.join(', ') : ''}`, 10, y); y += 8;
  doc.text(`Reason: ${referral.reason}`, 10, y); y += 8;
  doc.text(`History:`, 10, y); y += 8;
  if (referral.history) {
    Object.entries(referral.history).forEach(([key, val]) => {
      doc.text(`  ${key}: ${val || 'NA'}`, 10, y); y += 6;
    });
  }
  doc.text(`Physical Examination: ${referral.physicalExamination || 'NA'}`, 10, y); y += 8;
  doc.text(`General Appearance: ${referral.generalAppearance || 'NA'}`, 10, y); y += 8;
  doc.text(`Systemic Examination: ${Array.isArray(referral.systemicExamination) ? referral.systemicExamination.join(', ') : ''}`, 10, y); y += 8;
  doc.text(`Current Medications: ${referral.currentMedications}`, 10, y); y += 8;
  if (referral.currentMedications === 'Yes') {
    doc.text(`Medication Details: ${referral.medicationDetails}`, 10, y); y += 8;
  }
  if (referral.notes) {
    doc.text(`Notes: ${referral.notes}`, 10, y); y += 8;
  }

  doc.save(`referral_${referral.id}.pdf`);
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Doctor Referrals</h1>
        <p class="text-gray-600 mt-1">Manage patient doctor referrals and medical consultations</p>
      </div>
      <router-link
        :to="{ path: '/patientProfile/addReferral', query: { patientId: patientId } }"
        class="rs-button rs-button--primary flex items-center"
      >
        <Icon name="material-symbols:add" variant="primary" class="mr-1" />
        Add Referral
      </router-link>
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

    <!-- Referrals List -->
    <div v-else>
      <div v-if="referrals.length === 0" class="text-center py-12">
        <Icon name="material-symbols:medical-services" size="64" class="mx-auto mb-4 text-gray-300" />
        <h3 class="text-lg font-medium text-gray-600 mb-2">No Referrals Found</h3>
        <p class="text-gray-500">Start by adding a new doctor referral for this patient.</p>
        <router-link
          :to="{ path: '/patientProfile/addReferral', query: { patientId: patientId } }"
          class="rs-button rs-button--primary mt-4 flex items-center justify-center"
        >
          <Icon name="material-symbols:add" class="mr-1" />
          Add First Referral
        </router-link>
      </div>

      <div v-else class="space-y-4">
        <div 
          v-for="referral in referrals" 
          :key="referral.id"
          class="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
        >
          <div class="flex justify-between items-start mb-4">
            <div class="flex items-center space-x-3">
              <h3 class="text-lg font-semibold text-gray-900">{{ referral.recipient }}</h3>
            </div>
            <div class="flex space-x-2">
              <rs-button variant="outline" size="sm" @click="editReferral(referral)">
                <Icon name="material-symbols:edit" size="16" />
              </rs-button>
              <rs-button variant="outline" size="sm" @click="deleteReferral(referral.id)">
                <Icon name="material-symbols:delete" size="16" class="text-red-500" />
              </rs-button>
              <rs-button variant="outline" size="sm" @click="downloadReferralPdf(referral)">
                <Icon name="material-symbols:download" size="16" />
              </rs-button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <span class="text-sm font-medium text-gray-500">Hospital:</span>
              <p class="text-gray-900">{{ referral.hospital }}</p>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-500">Referral Date:</span>
              <p class="text-gray-900">{{ formatDate(referral.date) }}</p>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-500">Diagnosis:</span>
              <div>
                <span
                  v-for="(diag, idx) in referral.diagnosis"
                  :key="idx"
                  class="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded mr-1 mb-1 text-xs"
                >{{ diag }}</span>
              </div>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-500">Reason for Referral:</span>
              <p class="text-gray-900">{{ referral.reason }}</p>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-500">History:</span>
              <ul class="text-gray-900 text-sm list-disc ml-4">
                <li><strong>Presenting Concerns:</strong> {{ referral.history?.presentingConcerns || 'NA' }}</li>
                <li><strong>Developmental Milestone:</strong> {{ referral.history?.developmentalMilestone || 'NA' }}</li>
                <li><strong>Behavioral Concerns:</strong> {{ referral.history?.behavioralConcerns || 'NA' }}</li>
                <li><strong>Medical History:</strong> {{ referral.history?.medicalHistory || 'NA' }}</li>
                <li><strong>Medication/Allergies:</strong> {{ referral.history?.medicationAllergies || 'NA' }}</li>
                <li><strong>Family/Social Background:</strong> {{ referral.history?.familySocialBackground || 'NA' }}</li>
                <li><strong>Other Relevant History:</strong> {{ referral.history?.otherHistory || 'NA' }}</li>
              </ul>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-500">Physical Examination:</span>
              <p class="text-gray-900">{{ referral.physicalExamination || 'NA' }}</p>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-500">General Appearance:</span>
              <p class="text-gray-900">{{ referral.generalAppearance || 'NA' }}</p>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-500">Systemic Examination:</span>
              <div>
                <span
                  v-for="(sys, idx) in referral.systemicExamination"
                  :key="idx"
                  class="inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded mr-1 mb-1 text-xs"
                >{{ sys }}</span>
              </div>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-500">Current Medications:</span>
              <span class="text-gray-900">{{ referral.currentMedications }}</span>
              <div v-if="referral.currentMedications === 'Yes'">
                <span class="text-sm font-medium text-gray-500">Details:</span>
                <p class="text-gray-900">{{ referral.medicationDetails }}</p>
              </div>
            </div>
          </div>

          <div v-if="referral.notes">
            <span class="text-sm font-medium text-gray-500">Notes:</span>
            <p class="text-gray-700 mt-1 bg-gray-50 p-3 rounded">{{ referral.notes }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Referral Modal -->
    <rs-modal
      :title="selectedReferral ? 'Edit Referral' : 'New Referral'"
      v-model="showAddModal"
      size="lg"
    >
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Recipient *</label>
            <select
              v-model="referralForm.recipient"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              required
            >
              <option value="" disabled>Select recipient</option>
              <option v-for="option in recipientOptions" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
            <div v-if="referralForm.recipient === 'Other'" class="mt-2">
              <input
                v-model="referralForm.customRecipient"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="Enter recipient"
                required
              />
            </div>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Hospital/Clinic *</label>
          <input
            v-model="referralForm.hospital"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            placeholder="General Hospital Kuala Lumpur"
            required
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Referral Date *</label>
            <input
              v-model="referralForm.date"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              required
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
          <div class="flex flex-wrap gap-2 mb-2">
            <span
              v-for="(diag, idx) in referralForm.diagnosis"
              :key="idx"
              class="inline-flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
            >
              {{ diag }}
              <button type="button" class="ml-1 text-blue-500 hover:text-blue-700" @click="removeDiagnosis(idx)">
                &times;
              </button>
            </span>
          </div>
          <div class="flex">
            <input
              v-model="diagnosisInput"
              type="text"
              class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Add diagnosis and press Enter"
              @keyup.enter="addDiagnosis"
            />
            <rs-button variant="primary" class="ml-2" @click="addDiagnosis">Add</rs-button>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Reason for Referral *</label>
          <select
            v-model="referralForm.reason"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            required
          >
            <option value="" disabled>Select reason</option>
            <option v-for="option in reasonOptions" :key="option" :value="option">
              {{ option === 'Others' ? 'Others' : option }}
            </option>
          </select>
          <div v-if="referralForm.reason === 'Others'" class="mt-2">
            <input
              v-model="referralForm.customReason"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Enter reason"
              required
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">History</label>
          <div class="space-y-2">
            <input v-model="referralForm.history.presentingConcerns" type="text" class="w-full mb-1 px-3 py-2 border border-gray-300 rounded-md" placeholder="Presenting Concerns (or NA)" />
            <input v-model="referralForm.history.developmentalMilestone" type="text" class="w-full mb-1 px-3 py-2 border border-gray-300 rounded-md" placeholder="Developmental Milestone (or NA)" />
            <input v-model="referralForm.history.behavioralConcerns" type="text" class="w-full mb-1 px-3 py-2 border border-gray-300 rounded-md" placeholder="Behavioral Concerns (or NA)" />
            <input v-model="referralForm.history.medicalHistory" type="text" class="w-full mb-1 px-3 py-2 border border-gray-300 rounded-md" placeholder="Medical History (or NA)" />
            <input v-model="referralForm.history.medicationAllergies" type="text" class="w-full mb-1 px-3 py-2 border border-gray-300 rounded-md" placeholder="Medication/Allergies (or NA)" />
            <input v-model="referralForm.history.familySocialBackground" type="text" class="w-full mb-1 px-3 py-2 border border-gray-300 rounded-md" placeholder="Family/Social Background (or NA)" />
            <input v-model="referralForm.history.otherHistory" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Other Relevant History (or NA)" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Physical Examination (Optional)</label>
          <textarea
            v-model="referralForm.physicalExamination"
            rows="2"
            class="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Physical examination findings (or NA)"
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">General Appearance</label>
          <textarea
            v-model="referralForm.generalAppearance"
            rows="2"
            class="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="General appearance (or NA)"
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Systemic Examination</label>
          <div class="flex flex-wrap gap-2 mb-2">
            <label v-for="option in systemicOptions" :key="option" class="flex items-center space-x-2">
              <input
                type="checkbox"
                :value="option"
                v-model="referralForm.systemicExamination"
              />
              <span>{{ option }}</span>
            </label>
          </div>
          <div v-if="referralForm.systemicExamination.includes('Other')" class="mt-2">
            <input
              v-model="referralForm.customSystemic"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Specify other system"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Current Medications</label>
          <select
            v-model="referralForm.currentMedications"
            class="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
          <div v-if="referralForm.currentMedications === 'Yes'" class="mt-2">
            <input
              v-model="referralForm.medicationDetails"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Specify name and dose"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            v-model="referralForm.notes"
            rows="4"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            placeholder="Additional notes, observations, or recommendations..."
          ></textarea>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end space-x-3">
          <rs-button variant="outline" @click="closeAddModal">Cancel</rs-button>
          <rs-button variant="primary" @click="saveReferral">
            {{ selectedReferral ? 'Update' : 'Save' }} Referral
          </rs-button>
        </div>
      </template>
    </rs-modal>
  </div>
</template>