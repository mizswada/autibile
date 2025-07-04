<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import RsQuestionnaireForm from '~/components/RsQuestionnaireForm.vue';

const route = useRoute();
const router = useRouter();
const questionnaireId = route.params.id;

const questionnaire = ref(null);
const isLoading = ref(true);
const errorMessage = ref('');
const successMessage = ref('');
const patientId = ref('');

onMounted(async () => {
  await fetchQuestionnaireData();
});

async function fetchQuestionnaireData() {
  isLoading.value = true;
  try {
    const res = await fetch(`/api/questionnaire/listQuestionnaires?questionnaireID=${questionnaireId}`);
    const result = await res.json();

    if (res.ok && result.data && result.data.length > 0) {
      questionnaire.value = result.data[0];
    } else {
      errorMessage.value = 'Questionnaire not found';
      console.error('Questionnaire not found. API response:', result);
    }
  } catch (err) {
    console.error('Error loading questionnaire:', err);
    errorMessage.value = 'Error loading questionnaire';
  } finally {
    isLoading.value = false;
  }
}

async function handleSubmit(data) {
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
      
      // Redirect to the results page after a short delay
      setTimeout(() => {
        router.push(`/questionnaire/results/${result.data.respond_id}`);
      }, 2000);
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

    <div v-else-if="errorMessage" class="p-4 bg-red-100 text-red-700 rounded mb-4">
      {{ errorMessage }}
    </div>

    <div v-else-if="successMessage" class="p-4 bg-green-100 text-green-700 rounded mb-4">
      {{ successMessage }}
    </div>

    <div v-else-if="questionnaire">
      <!-- Patient ID Input -->
      <div class="card p-4 mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-1">Patient ID (Optional)</label>
        <input 
          type="text" 
          v-model="patientId" 
          placeholder="Enter Patient ID" 
          class="w-full md:w-1/3 p-2 border rounded"
        />
        <p class="text-sm text-gray-500 mt-1">
          If you're completing this questionnaire for a patient, enter their ID.
        </p>
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
    
    <div v-else class="text-center py-12">
      <div class="flex flex-col items-center">
        <Icon name="material-symbols:error-outline" size="64" class="text-gray-400 mb-4" />
        <h3 class="text-xl font-medium text-gray-600 mb-2">Questionnaire Not Found</h3>
        <p class="text-gray-500">The requested questionnaire could not be found.</p>
      </div>
    </div>
  </div>
</template> 