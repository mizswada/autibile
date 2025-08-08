<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import RsQuestionnaireForm from '~/components/RsQuestionnaireForm.vue';

const route = useRoute();
const router = useRouter();

const questionnaireId = route.params.id;
const patientId = route.query.patientId;

const questionnaire = ref(null);
const isLoading = ref(true);
const error = ref(null);
const message = ref('');
const messageType = ref('');

// Patient selection
const selectedPatientId = ref(patientId || '');
const patients = ref([]);
const patientMchatrStatus = ref(null);
const hasCompletedMchatr = ref(false);
const mchatrScore = ref(null);
const isEligibleForQuestionnaire2 = ref(false);

onMounted(async () => {
  await Promise.all([
    fetchQuestionnaireData(),
    fetchPatients()
  ]);
  
  // If this is questionnaire ID 1, check patient eligibility
  if (questionnaireId === '1' && patientId) {
    await checkPatientEligibility(patientId);
  }
  
  // If this is questionnaire ID 2, check if patient is eligible
  if (questionnaireId === '2' && patientId) {
    await checkQuestionnaire2Eligibility(patientId);
  }
});

async function checkPatientEligibility(patientId) {
  try {
    // Use the dedicated eligibility API endpoint
    const res = await fetch(`/api/questionnaire/checkMchatrEligibility?patientId=${patientId}`);
    const result = await res.json();
    
    if (res.ok && result.data) {
      hasCompletedMchatr.value = result.data.has_completed_mchatr;
      patientMchatrStatus.value = result.data.mchatr_status;
      
      // Get MCHAT-R score if completed
      if (result.data.has_completed_mchatr) {
        await getMchatrScore(patientId);
      }
    }
  } catch (err) {
    console.error('Error checking patient eligibility:', err);
  }
}

async function checkQuestionnaire2Eligibility(patientId) {
  try {
    // Check if patient has completed MCHAT-R and get the score
    const res = await fetch(`/api/questionnaire/responses/list?patientId=${patientId}&questionnaireId=1`);
    const result = await res.json();
    
    if (res.ok && result.data && result.data.length > 0) {
      const mchatrResponse = result.data[0];
      mchatrScore.value = mchatrResponse.total_score;
      
      // Check if score is between 3-7
      isEligibleForQuestionnaire2.value = mchatrScore.value >= 3 && mchatrScore.value <= 7;
    } else {
      isEligibleForQuestionnaire2.value = false;
    }
  } catch (err) {
    console.error('Error checking questionnaire 2 eligibility:', err);
    isEligibleForQuestionnaire2.value = false;
  }
}

async function getMchatrScore(patientId) {
  try {
    const res = await fetch(`/api/questionnaire/responses/list?patientId=${patientId}&questionnaireId=1`);
    const result = await res.json();
    
    if (res.ok && result.data && result.data.length > 0) {
      mchatrScore.value = result.data[0].total_score;
    }
  } catch (err) {
    console.error('Error getting MCHAT-R score:', err);
  }
}

async function fetchQuestionnaireData() {
  try {
    isLoading.value = true;
    const res = await fetch(`/api/questionnaire/listQuestionnaires?questionnaireID=${questionnaireId}`);
    const result = await res.json();

    if (res.ok && result.data && result.data.length > 0) {
      questionnaire.value = result.data[0];
    } else {
      error.value = 'Questionnaire not found';
    }
  } catch (err) {
    console.error('Error loading questionnaire:', err);
    error.value = 'Error loading questionnaire';
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
      console.error('Failed to load patients:', result.message);
    }
  } catch (err) {
    console.error('Error loading patients:', err);
  }
}

// Watch for patient selection changes
watch(selectedPatientId, async (newPatientId) => {
  if (newPatientId && questionnaireId === '1') {
    await checkPatientEligibility(newPatientId);
  } else if (newPatientId && questionnaireId === '2') {
    await checkQuestionnaire2Eligibility(newPatientId);
  } else {
    hasCompletedMchatr.value = false;
    patientMchatrStatus.value = null;
    mchatrScore.value = null;
    isEligibleForQuestionnaire2.value = false;
  }
});

function goBack() {
  router.push('/questionnaire');
}

function handleSubmit(data) {
  console.log('Questionnaire submitted:', data);
  
  // Send data to backend
  fetch('/api/questionnaire/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      questionnaireId: data.questionnaireId,
      answers: data.answers,
      patientId: selectedPatientId.value || null
    })
  })
  .then(response => response.json())
  .then(result => {
    if (result.statusCode === 200) {
      message.value = 'Questionnaire submitted successfully!';
      messageType.value = 'success';
      
      // Check if redirect to questionnaire 2 is needed
      if (result.data && result.data.redirect_to_questionnaire_2) {
        message.value = 'MCHAT-R completed! Redirecting to follow-up questionnaire...';
        setTimeout(() => {
          router.push(`/questionnaire/take/2?patientId=${selectedPatientId.value}`);
        }, 2000);
      } else {
        // Redirect after a short delay
        setTimeout(() => {
          router.push('/questionnaire');
        }, 2000);
      }
    } else {
      message.value = result.message || 'Error submitting questionnaire';
      messageType.value = 'error';
    }
  })
  .catch(error => {
    console.error('Error submitting questionnaire:', error);
    message.value = 'Error submitting questionnaire';
    messageType.value = 'error';
  });
}

function handleCancel() {
  router.push('/questionnaire');
}
</script>

<template>
  <div>
    <div class="flex items-center mb-4">
      <button @click="goBack" class="mr-2 p-2 rounded hover:bg-gray-100">
        <Icon name="ic:outline-arrow-back" />
      </button>
      <h1 class="text-2xl font-bold">Take Questionnaire</h1>
    </div>

    <div v-if="message" class="mb-4 p-3 rounded text-white"
      :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
      {{ message }}
    </div>

    <div v-if="isLoading" class="flex justify-center my-8">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>

    <div v-else-if="questionnaire">
      <!-- Questionnaire Header and Instructions -->
      <div class="card mb-6 p-4">
        <h2 class="text-xl font-semibold">{{ questionnaire.name }}</h2>
        <p class="text-sm text-gray-500">{{ questionnaire.description }}</p>
        
        <div v-if="questionnaire.header" class="mt-4 p-3 bg-gray-50 rounded border">
          <h3 class="text-lg font-medium mb-2">Instructions</h3>
          <div v-html="questionnaire.header" class="text-gray-700"></div>
        </div>
      </div>

      <!-- Patient Selection (Optional) -->
      <div class="card mb-6 p-4">
        <h3 class="text-lg font-medium mb-4">Select Patient (Optional)</h3>
        <div class="flex gap-4 items-end">
          <div class="flex-1">
            <label class="block text-sm font-medium text-gray-700 mb-2">Patient</label>
            <select 
              v-model="selectedPatientId"
              class="w-full p-3 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">No patient selected</option>
              <option 
                v-for="patient in patients" 
                :key="patient.childID" 
                :value="patient.childID"
              >
                {{ patient.fullname }} (Parent: {{ patient.parentUsername }})
              </option>
            </select>
          </div>
        </div>
        
        <!-- MCHAT-R Eligibility Status (only for questionnaire ID 1) -->
        <div v-if="questionnaireId === '1' && selectedPatientId" class="mt-4">
          <div v-if="hasCompletedMchatr" class="p-3 bg-red-100 border border-red-300 rounded text-red-700">
            <div class="flex items-center">
              <Icon name="ic:outline-warning" class="mr-2" />
              <span class="font-medium">MCHAT-R Already Completed</span>
            </div>
            <p class="text-sm mt-1">This patient has already completed the MCHAT-R questionnaire. It can only be taken once.</p>
            <p v-if="mchatrScore !== null" class="text-sm mt-1 font-medium">Score: {{ mchatrScore }}</p>
          </div>
          
          <div v-else-if="patientMchatrStatus === 'Disable'" class="p-3 bg-red-100 border border-red-300 rounded text-red-700">
            <div class="flex items-center">
              <Icon name="ic:outline-warning" class="mr-2" />
              <span class="font-medium">MCHAT-R Not Eligible</span>
            </div>
            <p class="text-sm mt-1">This patient is not eligible to take the MCHAT-R questionnaire.</p>
          </div>
          
          <div v-else-if="patientMchatrStatus === 'Enable' || patientMchatrStatus === null" class="p-3 bg-green-100 border border-green-300 rounded text-green-700">
            <div class="flex items-center">
              <Icon name="ic:outline-check-circle" class="mr-2" />
              <span class="font-medium">MCHAT-R Eligible</span>
            </div>
            <p class="text-sm mt-1">This patient is eligible to take the MCHAT-R questionnaire.</p>
          </div>
        </div>
        
        <!-- Questionnaire ID 2 Eligibility Status -->
        <div v-if="questionnaireId === '2' && selectedPatientId" class="mt-4">
          <div v-if="!isEligibleForQuestionnaire2 && mchatrScore !== null" class="p-3 bg-red-100 border border-red-300 rounded text-red-700">
            <div class="flex items-center">
              <Icon name="ic:outline-warning" class="mr-2" />
              <span class="font-medium">Not Eligible for Follow-up Questionnaire</span>
            </div>
            <p class="text-sm mt-1">This questionnaire is only available for patients who scored 3-7 on the MCHAT-R questionnaire.</p>
            <p class="text-sm mt-1 font-medium">MCHAT-R Score: {{ mchatrScore }} (Required: 3-7)</p>
          </div>
          
          <div v-else-if="!isEligibleForQuestionnaire2 && mchatrScore === null" class="p-3 bg-red-100 border border-red-300 rounded text-red-700">
            <div class="flex items-center">
              <Icon name="ic:outline-warning" class="mr-2" />
              <span class="font-medium">MCHAT-R Not Completed</span>
            </div>
            <p class="text-sm mt-1">This patient must complete the MCHAT-R questionnaire first.</p>
          </div>
          
          <div v-else-if="isEligibleForQuestionnaire2" class="p-3 bg-green-100 border border-green-300 rounded text-green-700">
            <div class="flex items-center">
              <Icon name="ic:outline-check-circle" class="mr-2" />
              <span class="font-medium">Eligible for Follow-up Questionnaire</span>
            </div>
            <p class="text-sm mt-1">This patient is eligible to take the follow-up questionnaire.</p>
            <p class="text-sm mt-1 font-medium">MCHAT-R Score: {{ mchatrScore }} (Required: 3-7)</p>
          </div>
        </div>
      </div>

      <!-- Questionnaire Form Component - Show only if eligible -->
      <div v-if="questionnaireId === '1' && selectedPatientId && (hasCompletedMchatr || patientMchatrStatus === 'Disable')" class="card p-6 text-center">
        <Icon name="ic:outline-block" size="64" class="text-red-400 mb-4 mx-auto" />
        <h3 class="text-xl font-medium text-gray-600 mb-2">Access Restricted</h3>
        <p class="text-gray-500">
          {{ hasCompletedMchatr 
            ? 'This patient has already completed the MCHAT-R questionnaire.' 
            : 'This patient is not eligible to take the MCHAT-R questionnaire.' 
          }}
        </p>
      </div>
      
      <div v-else-if="questionnaireId === '2' && selectedPatientId && !isEligibleForQuestionnaire2" class="card p-6 text-center">
        <Icon name="ic:outline-block" size="64" class="text-red-400 mb-4 mx-auto" />
        <h3 class="text-xl font-medium text-gray-600 mb-2">Access Restricted</h3>
        <p class="text-gray-500">
          {{ mchatrScore === null 
            ? 'This patient must complete the MCHAT-R questionnaire first.' 
            : 'This questionnaire is only available for patients who scored 3-7 on the MCHAT-R questionnaire.' 
          }}
        </p>
      </div>
      
      <RsQuestionnaireForm
        v-else
        :questionnaire-id="questionnaireId"
        :patient-id="selectedPatientId"
        :read-only="false"
        :questionnaire-data="questionnaire"
        :show-questions="true"
        @submit="handleSubmit"
        @cancel="handleCancel"
      />
    </div>

    <div v-else class="text-center py-12">
      <div class="flex flex-col items-center">
        <Icon name="material-symbols:quiz-outline" size="64" class="text-gray-400 mb-4" />
        <h3 class="text-xl font-medium text-gray-600 mb-2">Questionnaire Not Found</h3>
        <p class="text-gray-500">The requested questionnaire could not be found.</p>
      </div>
    </div>
  </div>
</template> 