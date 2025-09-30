<script setup>
import { ref, computed, onMounted } from 'vue';

const props = defineProps({
  patientId: {
    type: [String, Number],
    required: true
  },
  readOnly: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['submit', 'answers-updated']);

const mchatrFQuestions = ref([]);
const onePointQuestions = ref([]);
const mchatrScore = ref(null);
const answers = ref({}); // For single answers (radio)
const multipleAnswers = ref({}); // For multiple answers (checkbox)
const conditionalSubQuestions = ref({});
const loadingConditionalQuestions = ref({});
const isLoading = ref(true);

const progress = computed(() => {
  const allQuestions = [
    ...mchatrFQuestions.value,
    ...Object.values(conditionalSubQuestions.value).flat()
  ];
  
  const totalQuestions = allQuestions.length;
  const answeredQuestions = allQuestions.filter(q => {
    const questionId = q.question_id;
    return answers.value[questionId] !== undefined && answers.value[questionId] !== null;
  }).length;
  
  return totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
});

const requiredQuestionsAnswered = computed(() => {
  const allQuestions = [
    ...mchatrFQuestions.value,
    ...Object.values(conditionalSubQuestions.value).flat()
  ];
  
  return allQuestions
    .filter(q => q.is_required)
    .every(q => {
      const questionId = q.question_id;
      
      // Check single answers (radio)
      if (answers.value[questionId] !== undefined && answers.value[questionId] !== null) {
        return true;
      }
      
      // Check multiple answers (checkbox)
      if (multipleAnswers.value[questionId] && multipleAnswers.value[questionId].length > 0) {
        return true;
      }
      
      return false;
    });
});

onMounted(async () => {
  await loadMchatrFQuestions();
});

// Watch for patient ID changes and reload questions
watch(() => props.patientId, async (newPatientId, oldPatientId) => {
  if (newPatientId !== oldPatientId) {
    await loadMchatrFQuestions();
  }
});

async function loadMchatrFQuestions() {
  try {
    isLoading.value = true;
    
    // If no patient ID, don't load anything
    if (!props.patientId) {
      mchatrFQuestions.value = [];
      onePointQuestions.value = [];
      mchatrScore.value = null;
      return;
    }
    
    console.log(`Loading MCHATR-F questions for patient ${props.patientId}`);
    
    const res = await fetch(`/api/questionnaire/mchatr/getOnePointQuestions?patientId=${props.patientId}`);
    const result = await res.json();
    
    if (res.ok && result.data) {
      mchatrFQuestions.value = result.data.questions;
      onePointQuestions.value = result.data.one_point_mchatr_questions;
      mchatrScore.value = result.data.mchatr_total_score;
      
    } else {
      console.error('Error loading MCHATR-F questions:', result.message);
      console.error('Full response:', result);
    }
  } catch (err) {
    console.error('Error loading MCHATR-F questions:', err);
  } finally {
    isLoading.value = false;
  }
}

function extractOptionType(optionTitle) {
  if (!optionTitle) return 'radio';
  
  if (optionTitle.startsWith('[radio]')) return 'radio';
  if (optionTitle.startsWith('[checkbox]')) return 'checkbox';
  if (optionTitle.startsWith('[scale]')) return 'scale';
  if (optionTitle.startsWith('[text]')) return 'text';
  if (optionTitle.startsWith('[textarea]')) return 'textarea';
  
  return 'radio';
}

function cleanOptionTitle(optionTitle) {
  if (!optionTitle) return '';
  
  return optionTitle
    .replace(/^\[(radio|checkbox|scale|text|textarea)\]/, '')
    .trim();
}

function handleOptionSelect(questionId, optionId) {
  
  if (props.readOnly) {
    return;
  }
  
  
  // Find the question and the specific option being clicked
  // Check both main questions and conditional sub-questions
  let question = mchatrFQuestions.value.find(q => q.question_id === questionId);
  if (!question) {
    // Look in conditional sub-questions
    const allSubQuestions = Object.values(conditionalSubQuestions.value).flat();
    question = allSubQuestions.find(q => q.question_id === questionId);
  } else {
    console.log('Found in main questions:', question);
  }
  
  const selectedOption = question ? question.options.find(opt => opt.option_id === optionId) : null;
  
  if (!selectedOption) {
    return;
  }
  
  
  // Check if this specific option is a checkbox
  if (selectedOption.option_type === 'checkbox') {
    // Handle multiple answers (checkbox) - toggle selection
    const isCurrentlySelected = multipleAnswers.value[questionId] && multipleAnswers.value[questionId].includes(optionId);
    handleMultipleAnswerChange(questionId, optionId, !isCurrentlySelected);
  } else {
    // Handle single answer (radio) - clear other selections
    answers.value[questionId] = optionId;
    // Force reactivity update
    answers.value = { ...answers.value };
  }
  
  // Check for conditional sub-questions - only show if the selected option triggers them
  if (selectedOption && selectedOption.conditional_sub_questions_ids) {
    loadConditionalSubQuestions(questionId, selectedOption);
  } else {
    // Clear sub-questions if this option doesn't trigger them
    conditionalSubQuestions.value[questionId] = [];
  }
  
  
  emit('answers-updated', { single: answers.value, multiple: multipleAnswers.value });
}

function handleMultipleAnswerChange(questionId, optionId, isChecked) {
  
  if (!multipleAnswers.value[questionId]) {
    multipleAnswers.value[questionId] = [];
  }
  
  if (isChecked) {
    // Add option if not already selected
    if (!multipleAnswers.value[questionId].includes(optionId)) {
      multipleAnswers.value[questionId].push(optionId);
    }
  } else {
    // Remove option
    multipleAnswers.value[questionId] = multipleAnswers.value[questionId].filter(id => id !== optionId);
  }
  
  // Force reactivity update
  multipleAnswers.value = { ...multipleAnswers.value };
}

function isOptionSelected(questionId, optionId) {
  
  // Check single answers (radio)
  if (answers.value[questionId] === optionId) {
    return true;
  }
  
  // Check multiple answers (checkbox)
  if (multipleAnswers.value[questionId] && multipleAnswers.value[questionId].includes(optionId)) {
    return true;
  }
  
  return false;
}

function isCheckboxSelected(questionId, optionId) {
  return multipleAnswers.value[questionId] && multipleAnswers.value[questionId].includes(optionId);
}

function shouldShowSubQuestions(questionId) {
  // Check if the currently selected answer for this question triggers sub-questions
  const question = mchatrFQuestions.value.find(q => q.question_id === questionId);
  if (!question) return false;
  
  const selectedAnswer = answers.value[questionId];
  if (!selectedAnswer) return false;
  
  const selectedOption = question.options.find(opt => opt.option_id === selectedAnswer);
  if (!selectedOption) return false;
  
  const hasConditionalSubQuestions = selectedOption.conditional_sub_questions_ids && 
    JSON.parse(selectedOption.conditional_sub_questions_ids || '[]').length > 0;
  
  
  return hasConditionalSubQuestions;
}

async function loadConditionalSubQuestions(parentQuestionId, selectedOption) {
  loadingConditionalQuestions.value[parentQuestionId] = true;
  
  try {
    const conditionalSubQuestionsIds = JSON.parse(selectedOption.conditional_sub_questions_ids || '[]');
    
    if (conditionalSubQuestionsIds.length > 0) {
      // Fetch the conditional sub-questions
      const res = await fetch(`/api/questionnaire/questions/getConditionalSubQuestions?questionnaireID=2&parentQuestionID=${parentQuestionId}&selectedOptionValue=${selectedOption.option_value}`);
      const result = await res.json();
      
      if (res.ok && result.data && result.data.length > 0) {
        // Get options for each sub-question
        const subQuestionIds = result.data.map(q => q.question_id);
        const batchRes = await fetch(`/api/questionnaire/questions/options/batch?questionIDs=${subQuestionIds.join(',')}`);
        const batchResult = await batchRes.json();
        
        const subQuestions = result.data.map(q => {
          const questionOptions = batchResult.data && batchResult.data[q.question_id] ? batchResult.data[q.question_id] : [];
          return {
            ...q,
            options: questionOptions.map(option => ({
              ...option,
              option_type: extractOptionType(option.option_title),
              original_title: option.option_title,
              option_title: cleanOptionTitle(option.option_title),
              conditional_sub_questions_ids: option.conditional_sub_questions_ids
            })),
            optionsLoading: false,
            optionsError: false
          };
        });
        
        conditionalSubQuestions.value = {
          ...conditionalSubQuestions.value,
          [parentQuestionId]: subQuestions
        };
      }
    }
  } catch (err) {
    console.error('Error loading conditional sub-questions:', err);
    conditionalSubQuestions.value[parentQuestionId] = [];
  } finally {
    loadingConditionalQuestions.value[parentQuestionId] = false;
  }
}

function submitMchatrF() {
  if (!requiredQuestionsAnswered.value) {
    return;
  }
  
  const formattedAnswers = [];
  
  // Process main MCHATR-F questions - Single answers (radio)
  mchatrFQuestions.value.forEach(question => {
    const questionId = question.question_id;
    if (answers.value[questionId]) {
      formattedAnswers.push({
        question_id: parseInt(questionId),
        option_id: parseInt(answers.value[questionId]),
        patient_id: props.patientId ? parseInt(props.patientId) : null,
        parentID: question.parentID ? parseInt(question.parentID) : null,
        mchatr_id: question.mchatr_id ? parseInt(question.mchatr_id) : null
      });
    }
  });
  
  // Process main MCHATR-F questions - Multiple answers (checkbox)
  Object.keys(multipleAnswers.value).forEach(questionId => {
    const selectedOptions = multipleAnswers.value[questionId];
    if (selectedOptions && selectedOptions.length > 0) {
      selectedOptions.forEach(optionId => {
        formattedAnswers.push({
          question_id: parseInt(questionId),
          option_id: parseInt(optionId),
          patient_id: props.patientId ? parseInt(props.patientId) : null,
          parentID: null, // MCHATR-F questions have parentID = null
          mchatr_id: null // Will be set based on question mapping
        });
      });
    }
  });
  
  // Process conditional sub-questions
  Object.values(conditionalSubQuestions.value).flat().forEach(question => {
    const questionId = question.question_id;
    if (answers.value[questionId]) {
      formattedAnswers.push({
        question_id: parseInt(questionId),
        option_id: parseInt(answers.value[questionId]),
        patient_id: props.patientId ? parseInt(props.patientId) : null,
        parentID: question.parentID ? parseInt(question.parentID) : null,
        mchatr_id: question.mchatr_id ? parseInt(question.mchatr_id) : null
      });
    }
  });
  
  emit('submit', {
    questionnaireId: 2,
    answers: formattedAnswers
  });
}
</script>

<template>
  <div>
    <div v-if="isLoading" class="flex justify-center my-8">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
    
    <div v-else-if="mchatrFQuestions.length > 0" class="mchatr-f-container">
      <!-- MCHATR-F Header -->
      <div class="mb-6">
        <h2 class="text-2xl font-bold mb-2">M-CHAT-R/F Follow-up Questionnaire</h2>
        <p class="text-gray-600 mb-3">
          Based on your M-CHAT-R score of {{ mchatrScore }}, please answer follow-up questions for areas that showed elevated likelihood.
        </p>
        
        <!-- One Point Questions Summary -->
      </div>
      
      <!-- Progress Bar -->
      <div class="mb-6">
        <div class="flex justify-between text-sm mb-1">
          <span>Progress</span>
          <span>{{ progress }}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2.5">
          <div class="bg-orange-600 h-2.5 rounded-full" :style="{ width: `${progress}%` }"></div>
        </div>
      </div>
      
      <!-- MCHATR-F Questions -->
      <div class="space-y-6">
        <div 
          v-for="(question, index) in mchatrFQuestions" 
          :key="question.question_id" 
          class="card p-5 border-l-4 border-l-orange-300 bg-orange-50"
        >
          <div class="mb-3">
            <div class="text-xs text-orange-600 mb-2 flex items-center">
              <Icon name="ic:outline-subdirectory-arrow-right" class="mr-1" />
              MCHATR-F Follow-up Question {{ index + 1 }} of {{ mchatrFQuestions.length }}
            </div>
            
            <h3 class="text-lg font-medium">
              {{ question.question_text_bi || question.question_text }}
              <span v-if="question.is_required" class="text-red-500">*</span>
            </h3>
            <p v-if="question.question_text_bm" class="text-sm text-gray-500 mt-1">
              {{ question.question_text_bm }}
            </p>
          </div>
          
          <!-- Question Options -->
          <div v-if="question.options && question.options.length > 0" class="mt-4">
            <div class="space-y-2">
              <div 
                v-for="option in question.options" 
                :key="option.option_id"
                class="flex items-center p-3 border rounded cursor-pointer transition-colors"
                :class="{
                  'bg-orange-50 border-orange-300': isOptionSelected(question.question_id, option.option_id),
                  'hover:bg-gray-50': !props.readOnly,
                  'opacity-60 cursor-not-allowed': props.readOnly
                }"
                @click="handleOptionSelect(question.question_id, option.option_id)"
              >
                <div class="w-6 h-6 flex items-center justify-center mr-3">
                  <!-- Radio Button (single selection) -->
                  <div 
                    v-if="option.option_type === 'radio'"
                    class="w-4 h-4 rounded-full border-2"
                    :class="{
                      'border-orange-500': answers[question.question_id] === option.option_id,
                      'border-gray-300': answers[question.question_id] !== option.option_id
                    }"
                  >
                    <div 
                      v-if="answers[question.question_id] === option.option_id" 
                      class="w-2 h-2 rounded-full bg-orange-500 m-auto"
                    ></div>
                  </div>
                  
                  <!-- Checkbox (multiple selection) -->
                  <div 
                    v-else-if="option.option_type === 'checkbox'"
                    class="w-4 h-4 border-2 rounded"
                    :class="{
                      'border-orange-500 bg-orange-500': isCheckboxSelected(question.question_id, option.option_id),
                      'border-gray-300': !isCheckboxSelected(question.question_id, option.option_id)
                    }"
                  >
                    <div 
                      v-if="isCheckboxSelected(question.question_id, option.option_id)" 
                      class="w-2 h-2 bg-white rounded-sm m-auto mt-0.5"
                    ></div>
                  </div>
                  
                  <!-- Default radio button -->
                  <div 
                    v-else
                    class="w-4 h-4 rounded-full border-2"
                    :class="{
                      'border-orange-500': answers[question.question_id] === option.option_id,
                      'border-gray-300': answers[question.question_id] !== option.option_id
                    }"
                  >
                    <div 
                      v-if="answers[question.question_id] === option.option_id" 
                      class="w-2 h-2 rounded-full bg-orange-500 m-auto"
                    ></div>
                  </div>
                </div>
                <div>{{ option.option_title }}</div>
              </div>
            </div>
          </div>
          
          <!-- Loading indicator for conditional questions -->
          <div v-if="loadingConditionalQuestions[question.question_id]" class="card p-5 ml-8 border-l-4 border-l-green-300 bg-green-50 mt-4">
            <div class="flex items-center justify-center">
              <div class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-green-500 mr-2"></div>
              <span class="text-sm text-gray-500">Loading additional questions...</span>
            </div>
          </div>

          <!-- Conditional Sub-Questions -->
          <template v-if="conditionalSubQuestions[question.question_id] && conditionalSubQuestions[question.question_id].length > 0 && shouldShowSubQuestions(question.question_id)">
            <div 
              v-for="conditionalQuestion in conditionalSubQuestions[question.question_id]" 
              :key="conditionalQuestion.question_id" 
              class="card p-5 ml-8 border-l-4 border-l-green-300 bg-green-50 mt-4"
            >
              <div class="mb-3">
                <div class="text-xs text-green-600 mb-2 flex items-center">
                  <Icon name="ic:outline-subdirectory-arrow-right" class="mr-1" />
                  Additional Question
                </div>
                
                <h3 class="text-lg font-medium">
                  {{ conditionalQuestion.question_text_bi || conditionalQuestion.question_text }}
                  <span v-if="conditionalQuestion.is_required" class="text-red-500">*</span>
                </h3>
                <p v-if="conditionalQuestion.question_text_bm" class="text-sm text-gray-500 mt-1">
                  {{ conditionalQuestion.question_text_bm }}
                </p>
              </div>
              
              <!-- Conditional Question Options -->
              <div v-if="conditionalQuestion.options && conditionalQuestion.options.length > 0" class="mt-4">
                <div class="space-y-2">
                  <div 
                    v-for="option in conditionalQuestion.options" 
                    :key="option.option_id"
                    class="flex items-center p-3 border rounded cursor-pointer transition-colors"
                    :class="{
                      'bg-green-50 border-green-300': isOptionSelected(conditionalQuestion.question_id, option.option_id),
                      'hover:bg-gray-50': !props.readOnly,
                      'opacity-60 cursor-not-allowed': props.readOnly
                    }"
                    @click="handleOptionSelect(conditionalQuestion.question_id, option.option_id)"
                  >
                    <div class="w-6 h-6 flex items-center justify-center mr-3">
                      <!-- Radio Button (single selection) -->
                      <div 
                        v-if="option.option_type === 'radio'"
                        class="w-4 h-4 rounded-full border-2"
                        :class="{
                          'border-green-500': answers[conditionalQuestion.question_id] === option.option_id,
                          'border-gray-300': answers[conditionalQuestion.question_id] !== option.option_id
                        }"
                      >
                        <div 
                          v-if="answers[conditionalQuestion.question_id] === option.option_id" 
                          class="w-2 h-2 rounded-full bg-green-500 m-auto"
                        ></div>
                      </div>
                      
                      <!-- Checkbox (multiple selection) -->
                      <div 
                        v-else-if="option.option_type === 'checkbox'"
                        class="w-4 h-4 border-2 rounded"
                        :class="{
                          'border-green-500 bg-green-500': isCheckboxSelected(conditionalQuestion.question_id, option.option_id),
                          'border-gray-300': !isCheckboxSelected(conditionalQuestion.question_id, option.option_id)
                        }"
                      >
                        <div 
                          v-if="isCheckboxSelected(conditionalQuestion.question_id, option.option_id)" 
                          class="w-2 h-2 bg-white rounded-sm m-auto mt-0.5"
                        ></div>
                      </div>
                      
                      <!-- Default radio button -->
                      <div 
                        v-else
                        class="w-4 h-4 rounded-full border-2"
                        :class="{
                          'border-green-500': answers[conditionalQuestion.question_id] === option.option_id,
                          'border-gray-300': answers[conditionalQuestion.question_id] !== option.option_id
                        }"
                      >
                        <div 
                          v-if="answers[conditionalQuestion.question_id] === option.option_id" 
                          class="w-2 h-2 rounded-full bg-green-500 m-auto"
                        ></div>
                      </div>
                    </div>
                    <div>{{ option.option_title }}</div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
      
      <!-- Submit Button -->
      <div class="mt-8 flex justify-end gap-3">
        <rs-button 
          @click="submitMchatrF"
          :disabled="!requiredQuestionsAnswered || props.readOnly"
          :loading="false"
        >
          Submit MCHATR-F
        </rs-button>
      </div>
    </div>
    
    <div v-else-if="!props.patientId" class="text-center py-12">
      <div class="flex flex-col items-center">
        <Icon name="ic:outline-person" size="64" class="text-gray-400 mb-4" />
        <h3 class="text-xl font-medium text-gray-600 mb-2">Select a Patient</h3>
        <p class="text-gray-500">Please select a patient to view MCHATR-F follow-up questions.</p>
      </div>
    </div>
    
    <div v-else class="text-center py-12">
      <div class="flex flex-col items-center">
        <Icon name="ic:outline-quiz" size="64" class="text-gray-400 mb-4" />
        <h3 class="text-xl font-medium text-gray-600 mb-2">No MCHATR-F Questions Available</h3>
        <p class="text-gray-500">No follow-up questions are available for this patient.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mchatr-f-container {
  max-width: 800px;
  margin: 0 auto;
}
</style>
