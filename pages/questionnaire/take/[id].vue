<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import RsQuestionnaireForm from '~/components/RsQuestionnaireForm.vue';

const router = useRouter();
const route = useRoute();

const questionnaireId = computed(() => route.params.id);
const questionnaire = ref(null);
const patients = ref([]);
const patientId = ref('');
const isLoading = ref(true);
const errorMessage = ref('');
const successMessage = ref('');
const showResultsModal = ref(false);
const resultData = ref({
  totalScore: 0,
  interpretation: '',
  recommendation: '',
  respondId: null
});

onMounted(async () => {
  await Promise.all([
    fetchQuestionnaire(),
    fetchPatients()
  ]);
});

async function fetchQuestionnaire() {
  isLoading.value = true;
  try {
    const res = await fetch(`/api/questionnaire/listQuestionnaires?questionnaireID=${questionnaireId.value}`);
    const result = await res.json();

    if (res.ok && result.data && result.data.length > 0) {
      questionnaire.value = result.data[0];
    } else {
      errorMessage.value = 'Questionnaire not found';
    }
  } catch (err) {
    console.error('Error loading questionnaire:', err);
    errorMessage.value = 'Error loading questionnaire';
  } finally {
    isLoading.value = false;
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

async function handleSubmit(data) {
  if (!patientId.value) {
    errorMessage.value = 'Please select a patient before submitting';
    setTimeout(() => {
      errorMessage.value = '';
    }, 3000);
    return;
  }

  try {
    const res = await fetch('/api/questionnaire/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionnaireId: data.questionnaireId,
        answers: data.answers,
        patientId: patientId.value ? parseInt(patientId.value) : null
      })
    });
    
    const result = await res.json();

    if (res.ok && result.data) {
      successMessage.value = 'Questionnaire submitted successfully';
      
      // If we have threshold data, show the results modal
      if (result.data.threshold) {
        resultData.value = {
          totalScore: result.data.total_score,
          interpretation: result.data.threshold.interpretation,
          recommendation: result.data.threshold.recommendation,
          respondId: result.data.respond_id
        };
        showResultsModal.value = true;
      } else {
        // If no threshold data, redirect to results page after a short delay
        setTimeout(() => {
          router.push(`/questionnaire/results/${result.data.respond_id}`);
        }, 2000);
      }
    } else {
      errorMessage.value = result.message || 'Failed to submit questionnaire';
    }
  } catch (err) {
    console.error('Error submitting questionnaire:', err);
    errorMessage.value = 'Error submitting questionnaire';
  }
}

function handleCancel() {
  router.push('/questionnaire');
}

function goBack() {
  router.push('/questionnaire');
}

function closeResultsModal() {
  showResultsModal.value = false;
  router.push(`/questionnaire/results/${resultData.value.respondId}`);
}
</script>

<template>
  <div>
    <div class="flex items-center mb-4">
      <button @click="goBack" class="mr-2 p-2 rounded hover:bg-gray-100">
        <Icon name="material-symbols:arrow-back" />
      </button>
      <h1 class="text-2xl font-bold">Take Questionnaire</h1>
    </div>

    <div v-if="isLoading" class="flex justify-center my-8">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>

    <div v-if="errorMessage" class="p-4 bg-red-100 text-red-700 rounded mb-4">
      {{ errorMessage }}
    </div>

    <div v-if="successMessage" class="p-4 bg-green-100 text-green-700 rounded mb-4">
      {{ successMessage }}
    </div>

    <div v-if="questionnaire">
      <!-- Patient Selection -->
      <div class="card p-4 mb-6">
        <h2 class="text-lg font-semibold mb-3">Select Patient</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Patient <span class="text-red-500">*</span></label>
            <select 
              v-model="patientId"
              class="w-full p-2 border rounded"
              required
            >
              <option value="" disabled selected>Select a patient</option>
              <option 
                v-for="patient in patients" 
                :key="patient.childID" 
                :value="patient.childID"
              >
                {{ patient.fullname }} (ID: {{ patient.childID }})
              </option>
            </select>
            <p class="text-sm text-gray-500 mt-1">
              Select the patient who is taking this questionnaire.
            </p>
          </div>
          
          <div v-if="patientId" class="bg-blue-50 p-4 rounded border border-blue-100">
            <h3 class="text-sm font-medium text-blue-800 mb-2">Selected Patient</h3>
            <div v-if="patients.length">
              <div class="text-sm">
                <span class="font-medium">Name:</span> 
                {{ patients.find(p => p.childID == patientId)?.fullname || 'Unknown' }}
              </div>
              <div class="text-sm mt-1" v-if="patients.find(p => p.childID == patientId)?.nickname">
                <span class="font-medium">Nickname:</span> 
                {{ patients.find(p => p.childID == patientId)?.nickname }}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Questionnaire Form -->
      <RsQuestionnaireForm 
        :questionnaire-id="questionnaireId"
        :patient-id="patientId"
        :questionnaire-data="questionnaire"
        @submit="handleSubmit"
        @cancel="handleCancel"
      />
    </div>
    
    <div v-else-if="!isLoading" class="text-center py-12">
      <div class="flex flex-col items-center">
        <Icon name="material-symbols:error-outline" size="64" class="text-gray-400 mb-4" />
        <h3 class="text-xl font-medium text-gray-600 mb-2">Questionnaire Not Found</h3>
        <p class="text-gray-500">The requested questionnaire could not be found.</p>
      </div>
    </div>
    
    <!-- Results Modal -->
    <rs-modal
      title="Questionnaire Results"
      v-model="showResultsModal"
      :overlay-close="false"
      :hide-footer="true"
      size="lg"
    >
      <div class="p-4">
        <div class="mb-6 text-center">
          <div class="text-3xl font-bold mb-2">Score: {{ resultData.totalScore }}</div>
          <div class="text-sm text-gray-500" v-if="patientId && patients.length">
            Patient: {{ patients.find(p => p.childID == patientId)?.fullname || 'Unknown' }}
          </div>
        </div>
        
        <div class="mb-6 p-4 rounded bg-blue-50 border border-blue-200">
          <h3 class="text-lg font-medium mb-2 text-blue-800">Interpretation</h3>
          <p class="text-gray-700">{{ resultData.interpretation }}</p>
        </div>
        
        <div class="mb-6 p-4 rounded bg-green-50 border border-green-200">
          <h3 class="text-lg font-medium mb-2 text-green-800">Recommendation</h3>
          <p class="text-gray-700">{{ resultData.recommendation }}</p>
        </div>
        
        <!-- <div class="flex justify-center mt-6">
          <rs-button @click="closeResultsModal">
            View Detailed Results
          </rs-button>
        </div> -->
      </div>
    </rs-modal>
  </div>
</template> 