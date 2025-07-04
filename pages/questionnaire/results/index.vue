<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const responses = ref([]);
const isLoading = ref(true);
const error = ref(null);
const selectedQuestionnaire = ref(null);
const questionnaires = ref([]);
const selectedPatient = ref(null);
const patients = ref([]);

onMounted(async () => {
  await Promise.all([
    fetchQuestionnaires(),
    fetchPatients(),
    fetchResponses()
  ]);
});

async function fetchQuestionnaires() {
  try {
    const res = await fetch('/api/questionnaire/listQuestionnaires');
    const result = await res.json();
    
    if (res.ok && result.data) {
      questionnaires.value = result.data;
    } else {
      console.error('Failed to fetch questionnaires:', result.message);
    }
  } catch (err) {
    console.error('Error fetching questionnaires:', err);
  }
}

async function fetchPatients() {
  try {
    const res = await fetch('/api/parents/manageChild/listChild');
    const result = await res.json();
    
    if (res.ok && result.data) {
      patients.value = result.data;
    } else {
      console.error('Failed to fetch patients:', result.message);
    }
  } catch (err) {
    console.error('Error fetching patients:', err);
  }
}

async function fetchResponses() {
  isLoading.value = true;
  error.value = null;
  
  try {
    // Build query parameters
    const queryParams = new URLSearchParams();
    
    if (selectedQuestionnaire.value) {
      queryParams.append('questionnaireId', selectedQuestionnaire.value);
    }
    
    if (selectedPatient.value) {
      queryParams.append('patientId', selectedPatient.value);
    }
    
    const res = await fetch(`/api/questionnaire/responses/list?${queryParams}`);
    const result = await res.json();
    
    if (res.ok && result.data) {
      responses.value = result.data;
    } else {
      error.value = result.message || 'Failed to fetch responses';
    }
  } catch (err) {
    console.error('Error fetching responses:', err);
    error.value = 'An error occurred while fetching responses';
  } finally {
    isLoading.value = false;
  }
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function viewResponse(responseId) {
  navigateTo(`/questionnaire/results/${responseId}`);
}

function applyFilters() {
  fetchResponses();
}

function clearFilters() {
  selectedQuestionnaire.value = null;
  selectedPatient.value = null;
  fetchResponses();
}
</script>

<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold mb-2">Questionnaire Results</h1>
      <p class="text-gray-600">View and analyze questionnaire responses</p>
    </div>
    
    <!-- Filters -->
    <div class="bg-white p-4 rounded shadow mb-6">
      <h2 class="text-lg font-medium mb-3">Filters</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Questionnaire</label>
          <select 
            v-model="selectedQuestionnaire"
            class="w-full p-2 border rounded"
            @change="fetchResponses"
          >
            <option :value="null">All Questionnaires</option>
            <option 
              v-for="q in questionnaires" 
              :key="q.questionnaire_id" 
              :value="q.questionnaire_id"
            >
              {{ q.title }}
            </option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Patient</label>
          <select 
            v-model="selectedPatient"
            class="w-full p-2 border rounded"
            @change="fetchResponses"
          >
            <option :value="null">All Patients</option>
            <option 
              v-for="p in patients" 
              :key="p.patient_id" 
              :value="p.patient_id"
            >
              {{ p.fullname }}
            </option>
          </select>
        </div>
      </div>
    </div>
    
    <!-- Results Table -->
    <div class="bg-white rounded shadow">
      <div v-if="isLoading" class="p-8 text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
        <p class="mt-2 text-gray-600">Loading responses...</p>
      </div>
      
      <div v-else-if="error" class="p-8 text-center">
        <div class="text-red-500 mb-2">{{ error }}</div>
        <button 
          @click="fetchResponses"
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
      
      <div v-else-if="responses.length === 0" class="p-8 text-center">
        <div class="text-gray-500">No responses found</div>
      </div>
      
      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 text-left">
            <tr>
              <th class="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th class="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Questionnaire</th>
              <th class="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
              <th class="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Total Score</th>
              <th class="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th class="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="response in responses" :key="response.qr_id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">{{ response.qr_id }}</td>
              <td class="px-6 py-4">{{ response.questionnaire_title }}</td>
              <td class="px-6 py-4">{{ response.patient_name }}</td>
              <td class="px-6 py-4">{{ response.total_score }}</td>
              <td class="px-6 py-4">{{ formatDate(response.created_at) }}</td>
              <td class="px-6 py-4">
                <button 
                  @click="viewResponse(response.qr_id)"
                  class="text-blue-600 hover:text-blue-800"
                >
                  View Details
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template> 