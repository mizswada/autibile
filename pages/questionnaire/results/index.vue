<script setup>
import { ref, onMounted, computed } from 'vue';
import { navigateTo } from '#app';

const responses = ref([]);
const isLoading = ref(true);
const error = ref(null);
const selectedQuestionnaire = ref(null);
const questionnaires = ref([]);
const selectedPatient = ref(null);
const patients = ref([]);
const showDetailsModal = ref(false);
const selectedResponse = ref(null);
const patientDetails = ref(null);
const scoreThresholds = ref([]);
const loadingDetails = ref(false);

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

async function viewResponseDetails(responseId) {
  loadingDetails.value = true;
  showDetailsModal.value = true;
  
  try {
    // Fetch detailed response data
    const res = await fetch(`/api/questionnaire/responses/list?qrId=${responseId}`);
    const result = await res.json();
    
    if (res.ok && result.data && result.data.length > 0) {
      selectedResponse.value = result.data[0];
      
      // After getting the response, fetch the score thresholds for this questionnaire
      await fetchScoreThresholds(selectedResponse.value.questionnaire_id);
      
      // If we have a patient, fetch their details
      if (selectedResponse.value.patient_id) {
        await fetchPatientDetails(selectedResponse.value.patient_id);
      }
    } else {
      console.error('Failed to fetch response details:', result.message);
    }
  } catch (err) {
    console.error('Error fetching response details:', err);
  } finally {
    loadingDetails.value = false;
  }
}

async function fetchPatientDetails(patientId) {
  try {
    // Fetch all patients and find the matching one
    const res = await fetch('/api/parents/manageChild/listChild');
    const result = await res.json();
    
    if (res.ok && result.data) {
      const patient = result.data.find(p => p.childID === patientId);
      if (patient) {
        patientDetails.value = patient;
      }
    }
  } catch (err) {
    console.error('Error fetching patient details:', err);
  }
}

async function fetchScoreThresholds(questionnaireId) {
  try {
    // Fetch score thresholds from the API
    const res = await fetch(`/api/questionnaire/thresholds?questionnaireId=${questionnaireId}`);
    const result = await res.json();
    
    if (res.ok && result.data) {
      scoreThresholds.value = result.data;
    } else {
      console.error('Failed to load score thresholds:', result.message);
      // Fallback to default thresholds if API call fails
      scoreThresholds.value = [
        {
          threshold_id: 1,
          questionnaire_id: questionnaireId,
          scoring_min: 30,
          scoring_max: 100,
          interpretation: "Indicates risk for behavioural issues.",
          recommendation: "Recommend a more in-depth assessment by a qualified healthcare professional."
        },
        {
          threshold_id: 2,
          questionnaire_id: questionnaireId,
          scoring_min: 0,
          scoring_max: 29,
          interpretation: "Suggests a low risk for behavioural issues.",
          recommendation: "Encourage maintaining good routines and monitoring."
        }
      ];
    }
  } catch (err) {
    console.error('Error fetching score thresholds:', err);
    // Fallback to default thresholds if API call fails
    scoreThresholds.value = [
      {
        threshold_id: 1,
        questionnaire_id: questionnaireId,
        scoring_min: 30,
        scoring_max: 100,
        interpretation: "Indicates risk for behavioural issues.",
        recommendation: "Recommend a more in-depth assessment by a qualified healthcare professional."
      },
      {
        threshold_id: 2,
        questionnaire_id: questionnaireId,
        scoring_min: 0,
        scoring_max: 29,
        interpretation: "Suggests a low risk for behavioural issues.",
        recommendation: "Encourage maintaining good routines and monitoring."
      }
    ];
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

// Get the appropriate score interpretation based on the total score
const scoreInterpretation = computed(() => {
  if (!selectedResponse.value || !scoreThresholds.value.length) return null;
  
  const totalScore = selectedResponse.value.total_score || 0;
  
  for (const threshold of scoreThresholds.value) {
    // Check if the score falls within the min-max range
    if (totalScore >= threshold.scoring_min && totalScore <= threshold.scoring_max) {
      return threshold;
    }
  }
  
  return null;
});
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
              :key="p.childID" 
              :value="p.childID"
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
                <div class="flex space-x-3">
                  <button 
                    @click="viewResponseDetails(response.qr_id)"
                    class="text-blue-600 hover:text-blue-800 flex items-center"
                    title="View Details"
                  >
                    <Icon name="material-symbols:info-outline-rounded" class="mr-1" />
                  </button>
                  <button 
                    @click="viewResponse(response.qr_id)"
                    class="text-green-600 hover:text-green-800 flex items-center"
                    title="View Questionnaire and Answers"
                  >
                    <Icon name="material-symbols:visibility" class="mr-1" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- Patient Details Modal -->
    <rs-modal
      title="Patient Assessment Details"
      v-model="showDetailsModal"
      size="lg"
    >
      <div v-if="loadingDetails" class="p-8 text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
        <p class="mt-2 text-gray-600">Loading details...</p>
      </div>
      
      <div v-else-if="selectedResponse" class="p-4">
        <!-- Patient Information -->
        <div class="mb-6 border-b pb-6">
          <h3 class="text-lg font-semibold mb-4">Patient Information</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div class="mb-3">
                <div class="text-sm text-gray-500">Full Name</div>
                <div class="font-medium">{{ patientDetails?.fullname || selectedResponse.patient_name }}</div>
              </div>
              
              <div class="mb-3" v-if="patientDetails?.nickname">
                <div class="text-sm text-gray-500">Nickname</div>
                <div class="font-medium">{{ patientDetails.nickname }}</div>
              </div>
              
              <div class="mb-3" v-if="patientDetails?.gender">
                <div class="text-sm text-gray-500">Gender</div>
                <div class="font-medium">{{ patientDetails.gender }}</div>
              </div>
            </div>
            
            <div>
              <div class="mb-3" v-if="patientDetails?.dateOfBirth">
                <div class="text-sm text-gray-500">Date of Birth</div>
                <div class="font-medium">{{ formatDate(patientDetails.dateOfBirth) }}</div>
              </div>
              
              <div class="mb-3" v-if="patientDetails?.autismDiagnose">
                <div class="text-sm text-gray-500">Autism Diagnosis</div>
                <div class="font-medium">{{ patientDetails.autismDiagnose }}</div>
              </div>
              
              <div class="mb-3" v-if="patientDetails?.diagnosedDate">
                <div class="text-sm text-gray-500">Diagnosed Date</div>
                <div class="font-medium">{{ formatDate(patientDetails.diagnosedDate) }}</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Assessment Results -->
        <div class="mb-6">
          <h3 class="text-lg font-semibold mb-4">Assessment Results</h3>
          
          <div class="bg-blue-50 p-4 rounded border border-blue-100 mb-4">
            <div class="flex justify-between items-center mb-2">
              <div class="text-sm text-blue-700">Questionnaire</div>
              <div class="text-sm text-blue-700">Score</div>
            </div>
            <div class="flex justify-between items-center">
              <div class="font-medium">{{ selectedResponse.questionnaire_title }}</div>
              <div class="font-bold text-xl">{{ selectedResponse.total_score }}</div>
            </div>
            <div class="text-sm text-gray-500 mt-2">
              Completed on {{ formatDate(selectedResponse.created_at) }}
            </div>
          </div>
          
          <!-- Interpretation and Recommendation -->
          <div class="space-y-4">
            <div class="p-4 rounded bg-blue-50 border border-blue-200">
              <h4 class="font-medium text-blue-800 mb-2">Interpretation</h4>
              <p class="text-gray-700" v-if="scoreInterpretation">{{ scoreInterpretation.interpretation }}</p>
              <p class="text-gray-700" v-else>No specific interpretation available for this score. Please consult with a healthcare professional for assessment.</p>
            </div>
            
            <div class="p-4 rounded bg-green-50 border border-green-200">
              <h4 class="font-medium text-green-800 mb-2">Recommendation</h4>
              <p class="text-gray-700" v-if="scoreInterpretation">{{ scoreInterpretation.recommendation }}</p>
              <p class="text-gray-700" v-else>General recommendation: Monitor progress and consult with a healthcare professional if concerns persist.</p>
            </div>
          </div>
        </div>
      </div>
      
      <template #footer>
        <div class="flex justify-between">
          <rs-button @click="showDetailsModal = false">
            Close
          </rs-button>
        </div>
      </template>
    </rs-modal>
  </div>
</template> 