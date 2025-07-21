<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const patientId = computed(() => route.query.patientId || route.params.id);

// Data
const referrals = ref([]);
const isLoading = ref(true);
const error = ref(null);
const showAddModal = ref(false);
const selectedReferral = ref(null);

// Form data
const referralForm = ref({
  doctorName: '',
  specialty: '',
  hospital: '',
  date: new Date().toISOString().slice(0, 10),
  reason: '',
  notes: '',
  status: 'Scheduled',
  followUpDate: ''
});

// Status options
const statusOptions = [
  { label: 'Scheduled', value: 'Scheduled' },
  { label: 'In Progress', value: 'In Progress' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Cancelled', value: 'Cancelled' }
];

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
    doctorName: '',
    specialty: '',
    hospital: '',
    date: new Date().toISOString().slice(0, 10),
    reason: '',
    notes: '',
    status: 'Scheduled',
    followUpDate: ''
  };
}

function closeAddModal() {
  showAddModal.value = false;
  selectedReferral.value = null;
}

async function saveReferral() {
  try {
    const response = await fetch('/api/patientProfile/referrals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        patientId: parseInt(patientId.value),
        ...referralForm.value
      })
    });

    const result = await response.json();
    
    if (result.statusCode === 201) {
      // Add the new referral to the list
      referrals.value.unshift(result.data);
      closeAddModal();
    } else {
      console.error('Error saving referral:', result.message);
    }
  } catch (err) {
    console.error('Error saving referral:', err);
  }
}

function editReferral(referral) {
  selectedReferral.value = referral;
  referralForm.value = { ...referral };
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

function getStatusColor(status) {
  switch (status) {
    case 'Completed':
      return 'bg-green-100 text-green-800';
    case 'In Progress':
      return 'bg-blue-100 text-blue-800';
    case 'Scheduled':
      return 'bg-yellow-100 text-yellow-800';
    case 'Cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Doctor Referrals</h1>
        <p class="text-gray-600 mt-1">Manage patient doctor referrals and medical consultations</p>
      </div>
      <rs-button variant="primary" @click="openAddModal">
        <Icon name="material-symbols:add" class="mr-1" />
        New Referral
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

    <!-- Referrals List -->
    <div v-else>
      <div v-if="referrals.length === 0" class="text-center py-12">
        <Icon name="material-symbols:medical-services" size="64" class="mx-auto mb-4 text-gray-300" />
        <h3 class="text-lg font-medium text-gray-600 mb-2">No Referrals Found</h3>
        <p class="text-gray-500">Start by adding a new doctor referral for this patient.</p>
        <rs-button variant="primary" class="mt-4" @click="openAddModal">
          <Icon name="material-symbols:add" class="mr-1" />
          Add First Referral
        </rs-button>
      </div>

      <div v-else class="space-y-4">
        <div 
          v-for="referral in referrals" 
          :key="referral.id"
          class="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
        >
          <div class="flex justify-between items-start mb-4">
            <div class="flex items-center space-x-3">
              <h3 class="text-lg font-semibold text-gray-900">{{ referral.doctorName }}</h3>
              <span 
                class="px-2 py-1 text-xs rounded-full font-medium"
                :class="getStatusColor(referral.status)"
              >
                {{ referral.status }}
              </span>
            </div>
            <div class="flex space-x-2">
              <rs-button variant="outline" size="sm" @click="editReferral(referral)">
                <Icon name="material-symbols:edit" size="16" />
              </rs-button>
              <rs-button variant="outline" size="sm" @click="deleteReferral(referral.id)">
                <Icon name="material-symbols:delete" size="16" class="text-red-500" />
              </rs-button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <span class="text-sm font-medium text-gray-500">Specialty:</span>
              <p class="text-gray-900">{{ referral.specialty }}</p>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-500">Hospital:</span>
              <p class="text-gray-900">{{ referral.hospital }}</p>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-500">Referral Date:</span>
              <p class="text-gray-900">{{ formatDate(referral.date) }}</p>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-500">Follow-up Date:</span>
              <p class="text-gray-900">{{ formatDate(referral.followUpDate) }}</p>
            </div>
          </div>

          <div class="mb-4">
            <span class="text-sm font-medium text-gray-500">Reason for Referral:</span>
            <p class="text-gray-900 mt-1">{{ referral.reason }}</p>
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
            <label class="block text-sm font-medium text-gray-700 mb-1">Doctor Name *</label>
            <input
              v-model="referralForm.doctorName"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Dr. John Smith"
              required
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Specialty *</label>
            <input
              v-model="referralForm.specialty"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Pediatric Neurology"
              required
            />
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
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Follow-up Date</label>
            <input
              v-model="referralForm.followUpDate"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            v-model="referralForm.status"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option 
              v-for="option in statusOptions" 
              :key="option.value" 
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Reason for Referral *</label>
          <textarea
            v-model="referralForm.reason"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            placeholder="Describe the reason for this referral..."
            required
          ></textarea>
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