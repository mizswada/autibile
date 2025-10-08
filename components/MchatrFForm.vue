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

const emit = defineEmits(['submit', 'answers-updated', 'navigate-back']);

// Navigation function
function goBackToQuestionnaire() {
  // Emit event to parent to handle navigation
  emit('navigate-back');
}

const mchatrFQuestions = ref([]);
const onePointQuestions = ref([]);
const mchatrScore = ref(null);
const answers = ref({}); // For single answers (radio)
const multipleAnswers = ref({}); // For multiple answers (checkbox)
const textAnswers = ref({}); // For text input answers
const rangeAnswers = ref({}); // For range/scale answers
const conditionalSubQuestions = ref({});
const loadingConditionalQuestions = ref({});
const isLoading = ref(true);
const submissionResult = ref(null);
const showSubmissionResult = ref(false);

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
      
      // Check text answers
      if (textAnswers.value[questionId] && textAnswers.value[questionId].trim().length > 0) {
        return true;
      }
      
      // Check range answers
      if (rangeAnswers.value[questionId] !== undefined && rangeAnswers.value[questionId] !== null) {
        return true;
      }
      
      return false;
    });
});


onMounted(async () => {
  await loadMchatrFQuestions();
});

// Remove the problematic watcher that was causing infinite recursion

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
      
      console.log('📋 Loaded MCHATR-F questions:', mchatrFQuestions.value);
      console.log('🔍 Question options analysis:');
      mchatrFQuestions.value.forEach(question => {
        console.log(`Question ${question.question_id}:`, {
          question_text: question.question_text_bi,
          options_count: question.options?.length || 0,
          option_types: question.options?.map(opt => ({
            option_id: opt.option_id,
            option_title: opt.option_title,
            option_type: opt.option_type,
            option_value: opt.option_value
          })) || []
        });
      });
      
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
    console.log(`🔄 Toggling checkbox for question ${questionId}, option ${optionId}, currently selected: ${isCurrentlySelected}`);
    handleMultipleAnswerChange(questionId, optionId, !isCurrentlySelected);
  } else {
    // Handle single answer (radio) - clear other selections
    console.log(`📻 Selecting radio for question ${questionId}, option ${optionId}`);
    answers.value[questionId] = optionId;
    // Force reactivity update
    answers.value = { ...answers.value };
  }
  
  // Check for conditional sub-questions - only show if the selected option triggers them
  console.log('🔍 Checking for conditional sub-questions:', {
    questionId,
    selectedOption,
    hasConditionalSubQuestions: selectedOption && selectedOption.conditional_sub_questions_ids
  });
  
  if (selectedOption && selectedOption.conditional_sub_questions_ids) {
    console.log('✅ Option has conditional sub-questions, loading...');
    loadConditionalSubQuestions(questionId, selectedOption);
  } else {
    console.log('❌ Option does not have conditional sub-questions, clearing...');
    // Clear sub-questions if this option doesn't trigger them
    conditionalSubQuestions.value[questionId] = [];
  }
  
  
  emit('answers-updated', { 
    single: answers.value, 
    multiple: multipleAnswers.value,
    text: textAnswers.value,
    range: rangeAnswers.value
  });
}

function handleMultipleAnswerChange(questionId, optionId, isChecked) {
  console.log(`📝 Multiple answer change: question ${questionId}, option ${optionId}, checked: ${isChecked}`);
  
  if (!multipleAnswers.value[questionId]) {
    multipleAnswers.value[questionId] = [];
  }
  
  if (isChecked) {
    // Add option if not already selected
    if (!multipleAnswers.value[questionId].includes(optionId)) {
      multipleAnswers.value[questionId].push(optionId);
      console.log(`✅ Added option ${optionId} to question ${questionId}`);
    }
  } else {
    // Remove option
    multipleAnswers.value[questionId] = multipleAnswers.value[questionId].filter(id => id !== optionId);
    console.log(`❌ Removed option ${optionId} from question ${questionId}`);
  }
  
  // Force reactivity update
  multipleAnswers.value = { ...multipleAnswers.value };
  console.log(`📊 Updated multipleAnswers for question ${questionId}:`, multipleAnswers.value[questionId]);
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

function handleTextAnswerChange(questionId, value) {
  console.log(`📝 Text answer change: question ${questionId}, value: "${value}"`);
  textAnswers.value[questionId] = value;
  
  // Emit updated answers
  emit('answers-updated', { 
    single: answers.value, 
    multiple: multipleAnswers.value,
    text: textAnswers.value,
    range: rangeAnswers.value
  });
}

function handleRangeAnswerChange(questionId, value) {
  console.log(`📊 Range answer change: question ${questionId}, value: ${value}`);
  rangeAnswers.value[questionId] = value;
  
  // Emit updated answers
  emit('answers-updated', { 
    single: answers.value, 
    multiple: multipleAnswers.value,
    text: textAnswers.value,
    range: rangeAnswers.value
  });
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

async function submitMchatrF() {
  if (!requiredQuestionsAnswered.value) {
    return;
  }
  
  console.log('🚀 Submitting MCHATR-F form...');
  console.log('Single answers (radio):', answers.value);
  console.log('Multiple answers (checkbox):', multipleAnswers.value);
  
  // Debug: Show all questions and their mchatr_id
  console.log('📋 All MCHATR-F questions with mchatr_id:');
  mchatrFQuestions.value.forEach(q => {
    console.log(`Question ${q.question_id}: mchatr_id=${q.mchatr_id}, text="${q.question_text_bi?.substring(0, 50)}..."`);
  });
  
  // Debug: Show conditional sub-questions
  console.log('📋 Conditional sub-questions:');
  Object.entries(conditionalSubQuestions.value).forEach(([parentId, subQuestions]) => {
    console.log(`Parent ${parentId}:`, subQuestions.map(sq => ({
      question_id: sq.question_id,
      mchatr_id: sq.mchatr_id,
      text: sq.question_text_bi?.substring(0, 30) + "..."
    })));
  });
  
  const formattedAnswers = [];
  
  // Process main MCHATR-F questions - Single answers (radio)
  mchatrFQuestions.value.forEach(question => {
    const questionId = question.question_id;
    if (answers.value[questionId]) {
      const selectedOption = question.options.find(opt => opt.option_id === answers.value[questionId]);
      formattedAnswers.push({
        question_id: parseInt(questionId),
        option_id: parseInt(answers.value[questionId]),
        option_value: selectedOption ? parseInt(selectedOption.option_value) : 0,
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
      // Find the question to get option details
      const question = mchatrFQuestions.value.find(q => q.question_id === parseInt(questionId));
      if (question) {
        selectedOptions.forEach(optionId => {
          const selectedOption = question.options.find(opt => opt.option_id === optionId);
          formattedAnswers.push({
            question_id: parseInt(questionId),
            option_id: parseInt(optionId),
            option_value: selectedOption ? parseInt(selectedOption.option_value) : 0,
            patient_id: props.patientId ? parseInt(props.patientId) : null,
            parentID: null, // MCHATR-F questions have parentID = null
            mchatr_id: question.mchatr_id ? parseInt(question.mchatr_id) : null
          });
        });
      }
    }
  });
  
  // Process conditional sub-questions
  Object.entries(conditionalSubQuestions.value).forEach(([parentQuestionId, subQuestions]) => {
    // Find the parent question to get its mchatr_id
    const parentQuestion = mchatrFQuestions.value.find(q => q.question_id === parseInt(parentQuestionId));
    const parentMchatrId = parentQuestion ? parentQuestion.mchatr_id : null;
    
    subQuestions.forEach(question => {
      const questionId = question.question_id;
      
      // Process radio answers for sub-questions
      if (answers.value[questionId]) {
        const selectedOption = question.options.find(opt => opt.option_id === answers.value[questionId]);
        formattedAnswers.push({
          question_id: parseInt(questionId),
          option_id: parseInt(answers.value[questionId]),
          option_value: selectedOption ? parseInt(selectedOption.option_value) : 0,
          patient_id: props.patientId ? parseInt(props.patientId) : null,
          parentID: parseInt(parentQuestionId), // Use parent question ID as parentID
          mchatr_id: parentMchatrId ? parseInt(parentMchatrId) : null // Inherit mchatr_id from parent
        });
      }
      
      // Process checkbox answers for sub-questions
      if (multipleAnswers.value[questionId] && multipleAnswers.value[questionId].length > 0) {
        const selectedOptions = multipleAnswers.value[questionId];
        selectedOptions.forEach(optionId => {
          const selectedOption = question.options.find(opt => opt.option_id === optionId);
          formattedAnswers.push({
            question_id: parseInt(questionId),
            option_id: parseInt(optionId),
            option_value: selectedOption ? parseInt(selectedOption.option_value) : 0,
            patient_id: props.patientId ? parseInt(props.patientId) : null,
            parentID: parseInt(parentQuestionId), // Use parent question ID as parentID
            mchatr_id: parentMchatrId ? parseInt(parentMchatrId) : null // Inherit mchatr_id from parent
          });
        });
      }
    });
  });
  
  console.log('📤 Formatted answers to send:', formattedAnswers);
  
  // Use MCHATR-F specific scoring API
  try {
    const response = await fetch('/api/questionnaire/score/mchatrF', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        questionnaireId: 2,
        patientId: props.patientId,
        answers: formattedAnswers
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      // Store submission result and show it
      submissionResult.value = result.data;
      showSubmissionResult.value = true;
      
      emit('submit', {
        questionnaireId: 2,
        answers: formattedAnswers,
        scoringResult: result.data
      });
    } else {
      console.error('MCHATR-F scoring error:', result.message);
      // Fallback to regular submission
      emit('submit', {
        questionnaireId: 2,
        answers: formattedAnswers
      });
    }
  } catch (error) {
    console.error('Error submitting MCHATR-F:', error);
    // Fallback to regular submission
    emit('submit', {
      questionnaireId: 2,
      answers: formattedAnswers
    });
  }
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
              
              <!-- Conditional Question Answer Input -->
              <div class="mt-4">
                <!-- Text Input Type (answer_type: 33) -->
                <div v-if="conditionalQuestion.answer_type === 33" class="space-y-2">
                  <textarea
                    v-model="textAnswers[conditionalQuestion.question_id]"
                    :placeholder="`Enter your answer for: ${conditionalQuestion.question_text_bi}`"
                    :disabled="props.readOnly"
                    class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows="3"
                    @input="handleTextAnswerChange(conditionalQuestion.question_id, $event.target.value)"
                  ></textarea>
                  <div class="text-xs text-gray-500">
                    <Icon name="ic:outline-info" class="inline mr-1" />
                    Text input - enter your detailed response
                  </div>
                </div>

                <!-- Range/Scale Type (answer_type: 34) -->
                <div v-else-if="conditionalQuestion.answer_type === 34" class="space-y-2">
                  <div class="text-sm text-gray-600 mb-2">Select a value from 1 to 5:</div>
                  <div class="flex space-x-2">
                    <button
                      v-for="value in [1, 2, 3, 4, 5]"
                      :key="value"
                      @click="handleRangeAnswerChange(conditionalQuestion.question_id, value)"
                      :disabled="props.readOnly"
                      class="px-4 py-2 border rounded-md transition-colors"
                      :class="{
                        'bg-green-500 text-white border-green-500': rangeAnswers[conditionalQuestion.question_id] === value,
                        'bg-white text-gray-700 border-gray-300 hover:bg-gray-50': rangeAnswers[conditionalQuestion.question_id] !== value,
                        'opacity-60 cursor-not-allowed': props.readOnly
                      }"
                    >
                      {{ value }}
                    </button>
                  </div>
                  <div class="text-xs text-gray-500">
                    <Icon name="ic:outline-info" class="inline mr-1" />
                    Scale rating from 1 (lowest) to 5 (highest)
                  </div>
                </div>

                <!-- Multiple Choice Type (answer_type: 35) -->
                <div v-else-if="conditionalQuestion.options && conditionalQuestion.options.length > 0" class="space-y-2">
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
    
    <!-- Submission Result -->
    <div v-if="showSubmissionResult && submissionResult" class="mt-8">
      <div class="card p-6 bg-green-50 border border-green-200">
        <div class="flex items-center mb-4">
          <Icon name="ic:outline-check-circle" size="32" class="text-green-600 mr-3" />
          <h3 class="text-xl font-semibold text-green-800">MCHATR-F Submitted Successfully!</h3>
        </div>
        
        <!-- Total Score Display -->
        <div class="bg-white rounded-lg p-4 mb-4 border border-green-300">
          <div class="text-center">
            <div class="text-3xl font-bold text-green-600 mb-2">
              {{ submissionResult.total_score }}
            </div>
            <div class="text-lg text-green-700 font-medium">
              Total MCHATR-F Score
            </div>
            <div class="text-sm text-green-600 mt-1">
              Out of {{ submissionResult.question_scores.length }} questions
            </div>
          </div>
        </div>
        
        <!-- Result Interpretation -->
        <div 
          class="rounded-lg p-4 mb-4 border"
          :class="{
            'bg-red-50 border-red-300': submissionResult.result_interpretation.status === 'Positive',
            'bg-green-50 border-green-300': submissionResult.result_interpretation.status === 'Negative',
            'bg-gray-50 border-gray-300': submissionResult.result_interpretation.status === 'Invalid'
          }"
        >
          <div class="flex items-center mb-2">
            <Icon 
              :name="submissionResult.result_interpretation.status === 'Positive' ? 'ic:outline-warning' : 'ic:outline-check-circle'" 
              size="24" 
              :class="{
                'text-red-600': submissionResult.result_interpretation.status === 'Positive',
                'text-green-600': submissionResult.result_interpretation.status === 'Negative',
                'text-gray-600': submissionResult.result_interpretation.status === 'Invalid'
              }"
              class="mr-2" 
            />
            <h4 
              class="font-semibold text-lg"
              :class="{
                'text-red-800': submissionResult.result_interpretation.status === 'Positive',
                'text-green-800': submissionResult.result_interpretation.status === 'Negative',
                'text-gray-800': submissionResult.result_interpretation.status === 'Invalid'
              }"
            >
              {{ submissionResult.result_interpretation.status }} Result
            </h4>
          </div>
          <p 
            class="text-sm mb-2"
            :class="{
              'text-red-700': submissionResult.result_interpretation.status === 'Positive',
              'text-green-700': submissionResult.result_interpretation.status === 'Negative',
              'text-gray-700': submissionResult.result_interpretation.status === 'Invalid'
            }"
          >
            {{ submissionResult.result_interpretation.interpretation }}
          </p>
          <p 
            class="text-xs font-medium"
            :class="{
              'text-red-600': submissionResult.result_interpretation.status === 'Positive',
              'text-green-600': submissionResult.result_interpretation.status === 'Negative',
              'text-gray-600': submissionResult.result_interpretation.status === 'Invalid'
            }"
          >
            📋 {{ submissionResult.result_interpretation.recommendation }}
          </p>
        </div>
        
        <!-- Score Breakdown -->
        <div class="mb-4">
          <h4 class="font-semibold text-green-800 mb-2">Score Breakdown:</h4>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div class="flex justify-between">
              <span>Questions Scored 0:</span>
              <span class="font-medium">{{ submissionResult.summary.questions_scored_0 }}</span>
            </div>
            <div class="flex justify-between">
              <span>Questions Scored 1:</span>
              <span class="font-medium">{{ submissionResult.summary.questions_scored_1 }}</span>
            </div>
          </div>
        </div>
        
        <!-- Detailed Question Scores -->
        <div class="mb-4">
          <h4 class="font-semibold text-green-800 mb-2">Question Details:</h4>
          <div class="space-y-2 max-h-40 overflow-y-auto">
            <div 
              v-for="questionScore in submissionResult.question_scores" 
              :key="questionScore.question_id"
              class="flex justify-between items-center p-2 bg-white rounded border"
            >
              <span class="text-sm">Question {{ questionScore.question_id }}:</span>
              <div class="flex items-center gap-2">
                <span class="text-sm">{{ questionScore.scoring_logic.logic }}</span>
                <span 
                  class="px-2 py-1 rounded text-xs font-medium"
                  :class="questionScore.score === 1 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'"
                >
                  {{ questionScore.score }}
                </span>
              </div>
            </div>
          </div>
        </div>
        
            <!-- Action Buttons -->
            <div class="flex justify-between gap-2">
              <rs-button 
                @click="goBackToQuestionnaire"
                variant="outline"
                size="sm"
              >
                ← Back to Questionnaire List
              </rs-button>
              <div class="flex gap-2">
                <rs-button 
                  @click="showSubmissionResult = false"
                  variant="outline"
                  size="sm"
                >
                  Close Results
                </rs-button>
                <rs-button 
                  @click="window.print()"
                  size="sm"
                >
                  Print Results
                </rs-button>
              </div>
            </div>
      </div>
    </div>
    
    <div v-else-if="!props.patientId" class="text-center py-12">
      <!-- <div class="flex flex-col items-center">
        <Icon name="ic:outline-person" size="64" class="text-gray-400 mb-4" />
        <h3 class="text-xl font-medium text-gray-600 mb-2">Select a Patient</h3>
        <p class="text-gray-500">Please select a patient to view MCHATR-F follow-up questions.</p>
      </div> -->
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
