<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { navigateTo } from '#imports';
import RsQuestionnaireForm from '~/components/RsQuestionnaireForm.vue';

const route = useRoute();
const responseId = computed(() => route.params.id);

const response = ref(null);
const isLoading = ref(true);
const error = ref(null);
const scoreThresholds = ref([]);
const showDetailsView = ref(false);

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
      
      // After getting the response, fetch the score thresholds for this questionnaire
      await fetchScoreThresholds(response.value.questionnaire_id);
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
          threshold: 30,
          comparison: ">=",
          interpretation: "Indicates risk for behavioural sleep problem.",
          recommendation: "Recommend a more in-depth assessment by a qualified healthcare professional (e.g., paediatrician, sleep specialist)."
        },
        {
          threshold: 30,
          comparison: "<",
          interpretation: "Suggests a low risk for behavioural sleep problems.",
          recommendation: "Encourage maintaining good sleep hygiene and consistent bedtime routines."
        }
      ];
    }
  } catch (err) {
    console.error('Error fetching score thresholds:', err);
    // Fallback to default thresholds if API call fails
    scoreThresholds.value = [
      {
        threshold: 30,
        comparison: ">=",
        interpretation: "Indicates risk for behavioural sleep problem.",
        recommendation: "Recommend a more in-depth assessment by a qualified healthcare professional (e.g., paediatrician, sleep specialist)."
      },
      {
        threshold: 30,
        comparison: "<",
        interpretation: "Suggests a low risk for behavioural sleep problems.",
        recommendation: "Encourage maintaining good sleep hygiene and consistent bedtime routines."
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

function goBack() {
  navigateTo('/questionnaire/results');
}

function toggleView() {
  showDetailsView.value = !showDetailsView.value;
}

  // Group answers by questions for better display
const groupedAnswers = computed(() => {
  if (!response.value || !response.value.answers) return [];
  
  // First, get all questions from the answers
  const questions = {};
  response.value.answers.forEach(answer => {
    if (!questions[answer.question_id]) {
      questions[answer.question_id] = {
        question_id: answer.question_id,
        question_text: answer.question_text,
        question_text_bm: answer.question_text_bm, // Include Bahasa Malaysia text
        answers: [],
        parentID: answer.parentID || null, // Store parentID for organizing
      };
    }
    
    questions[answer.question_id].answers.push(answer);
  });
  
  // Separate parent questions and sub-questions
  const parentQuestions = {};
  const subQuestions = {};
  
  Object.values(questions).forEach(question => {
    if (question.parentID) {
      // This is a sub-question
      subQuestions[question.question_id] = question;
    } else {
      // This is a parent question
      parentQuestions[question.question_id] = question;
      // Initialize sub-questions array
      parentQuestions[question.question_id].subQuestions = [];
    }
  });
  
  // Associate sub-questions with their parents
  Object.values(subQuestions).forEach(subQuestion => {
    const parentID = subQuestion.parentID;
    if (parentQuestions[parentID]) {
      parentQuestions[parentID].subQuestions.push(subQuestion);
    }
  });
  
  // Return only parent questions (which now include their sub-questions)
  return Object.values(parentQuestions);
});

// Format answers for the questionnaire form component
const formattedAnswers = computed(() => {
  if (!response.value || !response.value.answers) return [];
  
  return response.value.answers.map(answer => ({
    question_id: answer.question_id,
    option_id: answer.option_id,
    text_answer: answer.text_answer,
    option_title: answer.option_title ? answer.option_title.replace(/^\[(radio|checkbox|scale|text|textarea)\]/, '') : '',
    option_value: answer.option_value
  }));
});

// Get the appropriate score interpretation based on the total score
const scoreInterpretation = computed(() => {
  if (!response.value || !scoreThresholds.value.length) return null;
  
  const totalScore = response.value.total_score || 0;
  
  for (const threshold of scoreThresholds.value) {
    if (threshold.comparison === ">=" && totalScore >= threshold.threshold) {
      return threshold;
    } else if (threshold.comparison === "<" && totalScore < threshold.threshold) {
      return threshold;
    }
  }
  
  return null;
});
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center">
        <button 
          @click="goBack"
          class="mr-3 flex items-center text-black hover:text-gray-800"
        >
          <Icon name="material-symbols:arrow-back" class="mr-1" />
        </button>
        <h1 class="text-2xl font-bold">Response Details</h1>
      </div>
      
      <button 
        @click="toggleView" 
        class="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        <Icon :name="showDetailsView ? 'material-symbols:format-list-bulleted' : 'material-symbols:visibility'" class="mr-1" />
        {{ showDetailsView ? 'Show Summary' : 'Show Questionnaire View' }}
      </button>
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
    
    <div v-else-if="response">
      <!-- Questionnaire Form View -->
      <div v-if="showDetailsView && response.questionnaire_id">
        <div class="bg-white p-6 rounded shadow mb-6">
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
        
        <RsQuestionnaireForm 
          :questionnaire-id="response.questionnaire_id"
          :patient-id="response.patient_id"
          :saved-answers="formattedAnswers"
          :read-only="true"
        />
      </div>
      
      <!-- Summary View -->
      <div v-else class="space-y-6">
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
        
        <!-- Score Interpretation -->
        <div v-if="scoreInterpretation" class="bg-white p-6 rounded shadow">
          <h2 class="text-xl font-bold mb-4">Score Interpretation</h2>
          
          <div class="p-4 rounded" :class="scoreInterpretation.comparison === '>=' && scoreInterpretation.threshold <= response.total_score ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'">
            <div class="font-medium text-lg mb-2" :class="scoreInterpretation.comparison === '>=' && scoreInterpretation.threshold <= response.total_score ? 'text-yellow-700' : 'text-green-700'">
              {{ scoreInterpretation.interpretation }}
            </div>
            <div class="text-gray-700">
              {{ scoreInterpretation.recommendation }}
            </div>
          </div>
        </div>
        
        <!-- Response Details -->
        <div class="bg-white p-6 rounded shadow">
          <h2 class="text-xl font-bold mb-4">Response Details</h2>
          
          <div v-for="(group, index) in groupedAnswers" :key="group.question_id" class="mb-6 pb-6" :class="{ 'border-b': index < groupedAnswers.length - 1 }">
            <!-- Parent Question -->
            <div class="mb-2">
              <div class="font-medium">{{ group.question_text }}</div>
              <div v-if="group.question_text_bm" class="text-sm text-gray-500 mt-1">{{ group.question_text_bm }}</div>
            </div>
            
            <!-- Parent Question Answers -->
                          <div class="pl-4 border-l-2 border-gray-200 mb-4">
              <div v-for="answer in group.answers" :key="answer.answer_id" class="mb-2">
                <div class="flex justify-between">
                  <div>
                    <!-- Show text answer if available, otherwise show option title -->
                    <template v-if="answer.text_answer">{{ answer.text_answer }}</template>
                    <template v-else>{{ (answer.option_title || '').replace(/^\[(radio|checkbox|scale|text|textarea)\]/, '') }}</template>
                  </div>
                  <div v-if="answer.option_value" class="text-blue-600 font-medium">{{ answer.option_value }} points</div>
                </div>
              </div>
            </div>
            
            <!-- Sub-questions -->
            <div v-if="group.subQuestions && group.subQuestions.length > 0" class="ml-6">
              <div v-for="subQuestion in group.subQuestions" :key="subQuestion.question_id" class="mb-4">
                <!-- Sub-question text -->
                <div class="mb-2 flex">
                  <Icon name="material-symbols:subdirectory-arrow-right" class="mr-1 text-gray-400 mt-1 flex-shrink-0" />
                  <div>
                    <div class="font-medium">{{ subQuestion.question_text }}</div>
                    <div v-if="subQuestion.question_text_bm" class="text-sm text-gray-500 mt-1">{{ subQuestion.question_text_bm }}</div>
                  </div>
                </div>
                
                <!-- Sub-question answers -->
                <div class="pl-4 border-l-2 border-gray-200 ml-4">
                  <div v-for="answer in subQuestion.answers" :key="answer.answer_id" class="mb-2">
                    <div class="flex justify-between">
                      <div>
                        <!-- Show text answer if available, otherwise show option title -->
                        <template v-if="answer.text_answer">{{ answer.text_answer }}</template>
                        <template v-else>{{ (answer.option_title || '').replace(/^\[(radio|checkbox|scale|text|textarea)\]/, '') }}</template>
                      </div>
                      <div v-if="answer.option_value" class="text-blue-600 font-medium">{{ answer.option_value }} points</div>
                    </div>
                  </div>
                </div>
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