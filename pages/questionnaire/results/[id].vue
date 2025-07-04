<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, navigateTo } from 'vue-router';

const route = useRoute();
const responseId = computed(() => route.params.id);

const response = ref(null);
const isLoading = ref(true);
const error = ref(null);

onMounted(async () => {
  await fetchResponseDetails();
});

async function fetchResponseDetails() {
  isLoading.value = true;
  error.value = null;
  
  try {
    const res = await fetch(`/api/questionnaire/responses/list?qrId=${responseId.value}`);
    const result = await res.json();
    
    if (res.ok && result.data && result.data.length > 0) {
      response.value = result.data[0];
      console.log('Response details:', response.value);
    } else {
      error.value = result.message || 'Response not found';
    }
  } catch (err) {
    console.error('Error fetching response details:', err);
    error.value = 'An error occurred while fetching response details';
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

function goBack() {
  navigateTo('/questionnaire/results');
}

// Group answers by questions for better display
const groupedAnswers = computed(() => {
  if (!response.value || !response.value.answers) return [];
  
  const grouped = {};
  
  response.value.answers.forEach(answer => {
    if (!grouped[answer.question_id]) {
      grouped[answer.question_id] = {
        question_id: answer.question_id,
        question_text: answer.question_text,
        answers: []
      };
    }
    
    grouped[answer.question_id].answers.push(answer);
  });
  
  return Object.values(grouped);
});
</script>

<template>
  <div class="p-6">
    <div class="flex items-center mb-6">
      <button 
        @click="goBack"
        class="mr-3 flex items-center text-blue-600 hover:text-blue-800"
      >
        <Icon name="material-symbols:arrow-back" class="mr-1" />
        Back to Results
      </button>
      <h1 class="text-2xl font-bold">Response Details</h1>
    </div>
    
    <div v-if="isLoading" class="p-8 text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
      <p class="mt-2 text-gray-600">Loading response details...</p>
    </div>
    
    <div v-else-if="error" class="p-8 text-center">
      <div class="text-red-500 mb-2">{{ error }}</div>
      <button 
        @click="fetchResponseDetails"
        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Try Again
      </button>
    </div>
    
    <div v-else-if="response" class="space-y-6">
      <!-- Response Summary -->
      <div class="bg-white p-6 rounded shadow">
        <h2 class="text-xl font-bold mb-4">Response Summary</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div class="mb-3">
              <div class="text-sm text-gray-500">Questionnaire</div>
              <div class="font-medium">{{ response.questionnaire_title }}</div>
            </div>
            
            <div class="mb-3">
              <div class="text-sm text-gray-500">Patient</div>
              <div class="font-medium">{{ response.patient_name }}</div>
            </div>
          </div>
          
          <div>
            <div class="mb-3">
              <div class="text-sm text-gray-500">Date Submitted</div>
              <div class="font-medium">{{ formatDate(response.created_at) }}</div>
            </div>
            
            <div class="mb-3">
              <div class="text-sm text-gray-500">Total Score</div>
              <div class="font-medium text-xl">{{ response.total_score }}</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Response Details -->
      <div class="bg-white p-6 rounded shadow">
        <h2 class="text-xl font-bold mb-4">Response Details</h2>
        
        <div v-for="(group, index) in groupedAnswers" :key="group.question_id" class="mb-6 pb-6" :class="{ 'border-b': index < groupedAnswers.length - 1 }">
          <div class="font-medium mb-2">{{ group.question_text }}</div>
          
          <div class="pl-4 border-l-2 border-gray-200">
            <div v-for="answer in group.answers" :key="answer.answer_id" class="mb-2">
              <div class="flex justify-between">
                <div>{{ answer.option_title }}</div>
                <div class="text-blue-600 font-medium">{{ answer.option_value }} points</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="p-8 text-center">
      <div class="text-gray-500">Response not found</div>
    </div>
  </div>
</template> 