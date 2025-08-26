<script setup>
import { ref, onMounted, watch, computed } from 'vue';
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

// New state for MCHAT-R results and confirmation
const showMchatrResults = ref(false);
const mchatrResults = ref(null);
const showContinueConfirmation = ref(false);

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

// Computed property to determine if questionnaire can be shown
const canShowQuestionnaire = computed(() => {
  // Always require a patient to be selected
  if (!selectedPatientId.value) return false;
  
  if (questionnaireId === '1') {
    // For MCHAT-R (questionnaire ID 1): Show if status is Enable OR null (treat null as Enable)
    const canShow = patientMchatrStatus.value === 'Enable' || patientMchatrStatus.value === null;
    console.log(`Questionnaire 1 (MCHAT-R) - Can show: ${canShow}, Status: ${patientMchatrStatus.value}`);
    return canShow;
  } else if (questionnaireId === '2') {
    // For questionnaire ID 2: Always show the form, but submission will be controlled separately
    console.log(`Questionnaire 2 - Always showing form, Eligible: ${isEligibleForQuestionnaire2.value}, Score: ${mchatrScore.value}`);
    return true;
  }
  return true;
});

async function checkQuestionnaire2Eligibility(patientId) {
  try {
    // Check if patient has completed MCHAT-R and get the score
    const res = await fetch(`/api/questionnaire/responses/list?patientId=${patientId}&questionnaireId=1`);
    const result = await res.json();
    
    if (res.ok && result.data && result.data.length > 0) {
      const mchatrResponse = result.data[0];
      mchatrScore.value = mchatrResponse.total_score;
      
      // Check if score is between 3-7 (inclusive)
      isEligibleForQuestionnaire2.value = mchatrScore.value >= 3 && mchatrScore.value <= 7;
      
      console.log(`Questionnaire 2 eligibility check: Score ${mchatrScore.value}, Eligible: ${isEligibleForQuestionnaire2.value}`);
    } else {
      // No MCHAT-R response found
      mchatrScore.value = null;
      isEligibleForQuestionnaire2.value = false;
      console.log('Questionnaire 2 eligibility check: No MCHAT-R response found');
    }
  } catch (err) {
    console.error('Error checking questionnaire 2 eligibility:', err);
    mchatrScore.value = null;
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
      error.value = 'Autism screening not found';
    }
  } catch (err) {
          console.error('Error loading autism screening:', err);
          error.value = 'Error loading autism screening';
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
  
  // Validate that a patient is selected
  if (!selectedPatientId.value) {
            message.value = 'Please select a patient before submitting the autism screening.';
    messageType.value = 'error';
    return;
  }
  
  // Additional validation for questionnaire ID 2
  if (questionnaireId === '2' && !isEligibleForQuestionnaire2.value) {
            message.value = 'This autism screening is only available for patients who scored 3-7 on the MCHAT-R autism screening.';
    messageType.value = 'error';
    return;
  }
  
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
              message.value = 'Autism screening submitted successfully!';
      messageType.value = 'success';
      
      // Check if this is MCHAT-R with score 3-7 that requires follow-up
      if (result.data && result.data.redirect_to_questionnaire_2) {
        // Show results and confirmation instead of auto-redirecting
        showMchatrResultsAndConfirmation(result.data);
      } else {
        // For other cases, redirect after a short delay
        setTimeout(() => {
          router.push('/questionnaire');
        }, 2000);
      }
    } else {
              message.value = result.message || 'Error submitting autism screening';
      messageType.value = 'error';
    }
  })
  .catch(error => {
          console.error('Error submitting autism screening:', error);
          message.value = 'Error submitting autism screening';
    messageType.value = 'error';
  });
}

function handleCancel() {
  router.push('/questionnaire');
}

function showMchatrResultsAndConfirmation(results) {
  mchatrResults.value = results;
  showMchatrResults.value = true;
  showContinueConfirmation.value = true;
}

function continueToQuestionnaire2() {
  showMchatrResults.value = false;
  showContinueConfirmation.value = false;
  mchatrResults.value = null;
  router.push(`/questionnaire/take/2?patientId=${selectedPatientId.value}`);
}

function goBackToQuestionnaire() {
  showMchatrResults.value = false;
  showContinueConfirmation.value = false;
  mchatrResults.value = null;
  router.push('/questionnaire');
}
</script>

<template>
  <div>
    <div class="flex items-center mb-4">
      <button @click="goBack" class="mr-2 p-2 rounded hover:bg-gray-100">
        <Icon name="ic:outline-arrow-back" />
      </button>
      <h1 class="text-2xl font-bold">Take Autism Screening</h1>
    </div>

    <div v-if="message" class="mb-4 p-3 rounded text-white"
      :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
      {{ message }}
    </div>

    <div v-if="error" class="mb-4 p-4 bg-red-100 border border-red-300 rounded text-red-700">
      <div class="flex items-center">
        <Icon name="ic:outline-error" class="mr-2" />
        <span class="font-medium">Access Denied</span>
      </div>
      <p class="mt-1">{{ error }}</p>
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

      <!-- Patient Selection (Required) -->
      <div class="card mb-6 p-4">
        <h3 class="text-lg font-medium mb-4">Select Patient <span class="text-red-500">*</span></h3>
        <div class="flex gap-4 items-end">
          <div class="flex-1">
            <label class="block text-sm font-medium text-gray-700 mb-2">Patient <span class="text-red-500">*</span></label>
            <select 
              v-model="selectedPatientId"
              class="w-full p-3 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Select a patient --</option>
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
          <div v-if="patientMchatrStatus === 'Disable'" class="p-3 bg-red-100 border border-red-300 rounded text-red-700">
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
            <p class="text-sm mt-1">
              {{ hasCompletedMchatr 
                ? 'This patient can retake the MCHAT-R questionnaire.' 
                : 'This patient is eligible to take the MCHAT-R questionnaire.' 
              }}
            </p>
            <p v-if="hasCompletedMchatr && mchatrScore !== null" class="text-sm mt-1 font-medium">Previous Score: {{ mchatrScore }}</p>
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
            <div class="mt-2 p-2 bg-red-50 border border-red-200 rounded">
              <p class="text-xs text-red-600 font-medium">⚠️ Form submission is disabled for this patient.</p>
              <p class="text-xs text-red-600 mt-1">📝 The questionnaire form is visible for review but cannot be submitted.</p>
            </div>
          </div>
          
          <div v-else-if="!isEligibleForQuestionnaire2 && mchatrScore === null" class="p-3 bg-red-100 border border-red-300 rounded text-red-700">
            <div class="flex items-center">
              <Icon name="ic:outline-warning" class="mr-2" />
              <span class="font-medium">MCHAT-R Not Completed</span>
            </div>
            <p class="text-sm mt-1">This patient must complete the MCHAT-R questionnaire first.</p>
            <div class="mt-2 p-2 bg-red-50 border border-red-200 rounded">
              <p class="text-xs text-red-600 font-medium">⚠️ Form submission is disabled for this patient.</p>
              <p class="text-xs text-red-600 mt-1">📝 The questionnaire form is visible for review but cannot be submitted.</p>
            </div>
          </div>
          
          <div v-else-if="isEligibleForQuestionnaire2" class="p-3 bg-green-100 border border-green-300 rounded text-green-700">
            <div class="flex items-center">
              <Icon name="ic:outline-check-circle" class="mr-2" />
              <span class="font-medium">Eligible for Follow-up Questionnaire</span>
            </div>
            <p class="text-sm mt-1">This patient is eligible to take the follow-up questionnaire.</p>
            <p class="text-sm mt-1 font-medium">MCHAT-R Score: {{ mchatrScore }} (Required: 3-7)</p>
            <div class="mt-2 p-2 bg-green-50 border border-green-200 rounded">
              <p class="text-xs text-green-600 font-medium">✅ Form submission is enabled for this patient.</p>
              <p class="text-xs text-green-600 mt-1">📝 The questionnaire form is fully functional and can be submitted.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Questionnaire Form Component - Show only if eligible -->
      <div v-if="questionnaireId === '1' && selectedPatientId && patientMchatrStatus === 'Disable'" class="card p-6 text-center">
        <Icon name="ic:outline-block" size="64" class="text-red-400 mb-4 mx-auto" />
        <h3 class="text-xl font-medium text-gray-600 mb-2">Access Restricted</h3>
        <p class="text-gray-500">
          This patient is not eligible to take the MCHAT-R questionnaire.
        </p>
      </div>
      

      <!-- Patient Selection Required Message -->
      <div v-if="!selectedPatientId" class="card p-6 text-center">
        <Icon name="ic:outline-person-add" size="64" class="text-blue-400 mb-4 mx-auto" />
        <h3 class="text-xl font-medium text-gray-600 mb-2">Patient Selection Required</h3>
        <p class="text-gray-500 mb-4">
          Please select a patient from the dropdown above to continue with the questionnaire.
        </p>
        <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p class="text-sm text-blue-700">
            <Icon name="ic:outline-info" class="inline mr-1" />
            A patient must be selected before you can take the questionnaire.
          </p>
        </div>
      </div>

      <!-- Show questionnaire form if eligible -->
      <RsQuestionnaireForm
        v-if="canShowQuestionnaire"
        :questionnaire-id="questionnaireId"
        :patient-id="selectedPatientId"
        :read-only="questionnaireId === '2' && !isEligibleForQuestionnaire2"
        :questionnaire-data="questionnaire"
        :show-questions="true"
        @submit="handleSubmit"
        @cancel="handleCancel"
      />
    </div>

    <!-- MCHAT-R Results and Confirmation Dialog -->
    <div v-if="showMchatrResults" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 max-w-md mx-4 w-full">
        <div class="text-center mb-6">
          <Icon name="ic:outline-check-circle" size="64" class="text-green-500 mx-auto mb-4" />
          <h3 class="text-xl font-semibold text-gray-800 mb-2">MCHAT-R Completed!</h3>
          <p class="text-gray-600">Your MCHAT-R questionnaire has been submitted successfully.</p>
        </div>

        <!-- Results Summary -->
        <div class="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 class="font-medium text-gray-800 mb-2">Results Summary</h4>
          <div class="space-y-2">
            <div class="flex justify-between">
              <span class="text-gray-600">Total Score:</span>
              <span class="font-semibold">{{ mchatrResults.total_score }}</span>
            </div>
            <div v-if="mchatrResults.score_interpretation" class="border-t pt-2">
              <div class="text-sm text-gray-600 mb-1">Risk Level:</div>
              <div class="text-sm font-medium text-gray-800">{{ mchatrResults.score_interpretation }}</div>
            </div>
            <div v-if="mchatrResults.threshold" class="border-t pt-2">
              <div class="text-sm text-gray-600 mb-1">Interpretation:</div>
              <div class="text-sm font-medium text-gray-800">{{ mchatrResults.threshold.interpretation }}</div>
            </div>
          </div>
        </div>

        <!-- Follow-up Recommendation -->
        <div v-if="mchatrResults.redirect_to_questionnaire_2" class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div class="flex items-start">
            <Icon name="ic:outline-info" class="text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <h4 class="font-medium text-blue-800 mb-1">Follow-up Required</h4>
              <p class="text-sm text-blue-700">
                Based on your score of {{ mchatrResults.total_score }}, we recommend taking the follow-up questionnaire to gather more detailed information.
              </p>
            </div>
          </div>
        </div>

        <!-- No Follow-up Required Message -->
        <div v-else-if="mchatrResults.questionnaire_id === 1" class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div class="flex items-start">
            <Icon name="ic:outline-check-circle" class="text-green-500 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <h4 class="font-medium text-green-800 mb-1">No Follow-up Required</h4>
              <p class="text-sm text-green-700">
                Based on your score of {{ mchatrResults.total_score }}, no additional questionnaires are required at this time.
              </p>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-3">
          <button 
            v-if="mchatrResults.redirect_to_questionnaire_2"
            @click="continueToQuestionnaire2"
            class="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Continue to Follow-up
          </button>
        </div>
      </div>
    </div>

    <!-- <div v-else class="text-center py-12">
      <div class="flex flex-col items-center">
        <Icon name="material-symbols:quiz-outline" size="64" class="text-gray-400 mb-4" />
        <h3 class="text-xl font-medium text-gray-600 mb-2">Questionnaire Not Found</h3>
        <p class="text-gray-500">The requested questionnaire could not be found.</p>
      </div>
    </div> -->
  </div>
</template> 