<script setup>
import { ref, onMounted, computed } from 'vue';

const props = defineProps({
  questionnaireId: {
    type: [String, Number],
    required: true
  },
  patientId: {
    type: [String, Number],
    default: null
  },
  readOnly: {
    type: Boolean,
    default: false
  },
  savedAnswers: {
    type: Array,
    default: () => []
  },
  questionnaireData: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['submit', 'cancel']);

const questionnaire = ref(null);
const questions = ref([]);
const answers = ref({});
const textAnswers = ref({}); // For text/textarea inputs
const isLoading = ref(true);
const errorMessage = ref('');
const successMessage = ref('');
const isSubmitting = ref(false);

const progress = computed(() => {
  if (!questions.value.length) return 0;
  
  const totalQuestions = questions.value.length;
  const answeredQuestions = questions.value.filter(q => {
    const questionId = q.question_id;
    const questionType = getQuestionOptionType(q);
    
    // For text or textarea questions, check textAnswers
    if (questionType === 'text' || questionType === 'textarea' || q.answer_type === 33) {
      return textAnswers.value[questionId] !== undefined && textAnswers.value[questionId] !== '';
    } 
    // For all other question types, check answers
    else {
      return answers.value[questionId] !== undefined && answers.value[questionId] !== null;
    }
  }).length;
  
  return Math.round((answeredQuestions / totalQuestions) * 100);
});

const requiredQuestionsAnswered = computed(() => {
  return questions.value
    .filter(q => q.is_required)
    .every(q => {
      const questionId = q.question_id;
      const questionType = getQuestionOptionType(q);
      
      // For text or textarea questions, check textAnswers
      if (questionType === 'text' || questionType === 'textarea' || q.answer_type === 33) {
        return textAnswers.value[questionId] !== undefined && textAnswers.value[questionId] !== '';
      } 
      // For all other question types, check answers
      else {
        return answers.value[questionId] !== undefined && answers.value[questionId] !== null;
      }
    });
});

onMounted(async () => {
  // Use questionnaire data from props if available
  if (props.questionnaireData) {
    questionnaire.value = props.questionnaireData;
  } else {
    await fetchQuestionnaire();
  }
  
  await fetchQuestions();
  
  // If we have saved answers, populate them
  if (props.savedAnswers && props.savedAnswers.length) {
    populateSavedAnswers();
  }
});

function populateSavedAnswers() {
  props.savedAnswers.forEach(answer => {
    if (answer.text_answer) {
      textAnswers.value[answer.question_id] = answer.text_answer;
    } else {
      answers.value[answer.question_id] = answer.option_id;
    }
  });
}

async function fetchQuestionnaire() {
  isLoading.value = true;
  try {
    const res = await fetch(`/api/questionnaire/listQuestionnaires?questionnaireID=${props.questionnaireId}`);
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

async function fetchQuestions() {
  isLoading.value = true;
  try {
    // First fetch all questions for this questionnaire
    const res = await fetch(`/api/questionnaire/questions/listQuestions?questionnaireID=${props.questionnaireId}&status=Active`);
    const result = await res.json();

    if (res.ok && result.data) {
      // Separate parent questions and sub-questions
      const allQuestions = result.data;
      const parentQuestions = allQuestions.filter(q => q.parentID === null);
      const subQuestions = allQuestions.filter(q => q.parentID !== null);
      
      // Organize questions in hierarchical order
      const organizedQuestions = [];
      
      // Add parent questions and their sub-questions in sequence
      for (const parentQuestion of parentQuestions) {
        // Add the parent question
        organizedQuestions.push(parentQuestion);
        
        // Find and add all sub-questions for this parent
        const children = subQuestions.filter(sq => sq.parentID === parentQuestion.question_id);
        organizedQuestions.push(...children);
      }
      
      // Initialize questions with empty options arrays
      questions.value = organizedQuestions.map(q => ({
        ...q,
        options: [],
        optionsLoading: true,
        optionsError: false
      }));
      
      // Fetch options for all questions in batches to avoid overwhelming the server
      const batchSize = 5;
      for (let i = 0; i < questions.value.length; i += batchSize) {
        const batch = questions.value.slice(i, i + batchSize);
        await Promise.all(batch.map(question => fetchQuestionOptions(question)));
      }
    } else {
      errorMessage.value = result.message || 'Failed to load questions';
    }
  } catch (err) {
    console.error('Error loading questions:', err);
    errorMessage.value = 'Error loading questions';
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
  
  return 'radio'; // Default
}

function cleanOptionTitle(optionTitle) {
  if (!optionTitle) return '';
  
  return optionTitle
    .replace(/^\[(radio|checkbox|scale|text|textarea)\]/, '')
    .trim();
}

async function fetchQuestionOptions(question) {
  question.optionsLoading = true;
  question.optionsError = false;
  
  try {
    const res = await fetch(`/api/questionnaire/questions/options/list?questionID=${question.question_id}`);
    const result = await res.json();

    if (res.ok && result.data) {
      // Process options to extract type from title
      question.options = result.data.map(option => ({
        ...option,
        option_type: extractOptionType(option.option_title),
        original_title: option.option_title,
        option_title: cleanOptionTitle(option.option_title)
      }));
      question.optionsLoading = false;
    } else {
      console.error(`Failed to load options for question ${question.question_id}:`, result.message);
      question.optionsError = true;
      question.optionsLoading = false;
    }
  } catch (err) {
    console.error(`Error loading options for question ${question.question_id}:`, err);
    question.optionsError = true;
    question.optionsLoading = false;
  }
}

// Add a function to retry loading options if they fail
async function retryLoadOptions(question) {
  question.optionsLoading = true;
  question.optionsError = false;
  await fetchQuestionOptions(question);
}

function handleOptionSelect(questionId, optionId) {
  if (props.readOnly) return;
  answers.value[questionId] = optionId;
}

function handleTextInput(questionId, value) {
  if (props.readOnly) return;
  textAnswers.value[questionId] = value;
}

function getQuestionOptionType(question) {
  // First check the answer_type of the question
  if (question.answer_type === 33) return 'text'; // Text Type
  if (question.answer_type === 34) return 'range'; // Range Type
  if (question.answer_type === 35) { // Option Type
    // For option type, check the first option's type
    if (!question.options || question.options.length === 0) return 'radio';
    return question.options[0].option_type || 'radio';
  }
  
  // Fallback to checking options if answer_type is not set
  if (!question.options || question.options.length === 0) return 'none';
  
  // Check if any option has a text or textarea type
  const hasTextOption = question.options.some(o => 
    o.option_type === 'text' || o.option_type === 'textarea'
  );
  
  if (hasTextOption) {
    // Find the specific text option type
    const textOption = question.options.find(o => o.option_type === 'textarea');
    return textOption ? 'textarea' : 'text';
  }
  
  return question.options[0].option_type || 'radio';
}

async function submitQuestionnaire() {
  if (!requiredQuestionsAnswered.value) {
    errorMessage.value = 'Please answer all required questions';
    setTimeout(() => {
      errorMessage.value = '';
    }, 3000);
    return;
  }

  isSubmitting.value = true;
  
  try {
    // Format answers for submission
    const formattedAnswers = [];
    
    // Process all questions based on their answer type
    questions.value.forEach(question => {
      const questionId = question.question_id;
      const answerType = question.answer_type;
      const parentID = question.parentID; // Get parent ID for sub-questions
      const questionType = getQuestionOptionType(question);
      
      // Handle Text Type (answer_type = 33 or questionType is text/textarea)
      if (answerType === 33 || questionType === 'text' || questionType === 'textarea') {
        if (textAnswers.value[questionId]) {
          formattedAnswers.push({
            question_id: parseInt(questionId),
            option_id: null, // No option for text type
            text_answer: textAnswers.value[questionId],
            patient_id: props.patientId ? parseInt(props.patientId) : null,
            parentID: parentID ? parseInt(parentID) : null // Include parentID if it exists
          });
        }
      }
      // Handle Range Type (answer_type = 34)
      else if (answerType === 34) {
        if (answers.value[questionId]) {
          formattedAnswers.push({
            question_id: parseInt(questionId),
            option_id: null, // No specific option ID for range
            numeric_answer: parseInt(answers.value[questionId]),
            patient_id: props.patientId ? parseInt(props.patientId) : null,
            parentID: parentID ? parseInt(parentID) : null // Include parentID if it exists
          });
        }
      }
      // Handle Option Type (answer_type = 35)
      else if (answerType === 35) {
        if (answers.value[questionId]) {
          formattedAnswers.push({
            question_id: parseInt(questionId),
            option_id: parseInt(answers.value[questionId]),
            patient_id: props.patientId ? parseInt(props.patientId) : null,
            parentID: parentID ? parseInt(parentID) : null // Include parentID if it exists
          });
        }
      }
      // Fallback for questions with no answer_type but with answers
      else if (answers.value[questionId]) {
        formattedAnswers.push({
          question_id: parseInt(questionId),
          option_id: parseInt(answers.value[questionId]),
          patient_id: props.patientId ? parseInt(props.patientId) : null,
          parentID: parentID ? parseInt(parentID) : null // Include parentID if it exists
        });
      }
      // Fallback for questions with no answer_type but with text answers
      else if (textAnswers.value[questionId]) {
        // Find the text option for this question
        const textOption = question.options && question.options.find(o => 
          o.option_type === 'text' || o.option_type === 'textarea'
        );
        
        formattedAnswers.push({
          question_id: parseInt(questionId),
          option_id: textOption ? parseInt(textOption.option_id) : null,
          text_answer: textAnswers.value[questionId],
          patient_id: props.patientId ? parseInt(props.patientId) : null,
          parentID: parentID ? parseInt(parentID) : null // Include parentID if it exists
        });
      }
    });

    console.log('Submitting answers:', formattedAnswers);
    
    emit('submit', {
      questionnaireId: parseInt(props.questionnaireId),
      answers: formattedAnswers
    });
    
    successMessage.value = 'Questionnaire submitted successfully';
    setTimeout(() => {
      successMessage.value = '';
    }, 3000);
  } catch (err) {
    console.error('Error submitting questionnaire:', err);
    errorMessage.value = 'Error submitting questionnaire';
    setTimeout(() => {
      errorMessage.value = '';
    }, 3000);
  } finally {
    isSubmitting.value = false;
  }
}

function cancelQuestionnaire() {
  emit('cancel');
}
</script>

<template>
  <div>
    <div v-if="isLoading" class="flex justify-center my-8">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
    
    <div v-else-if="errorMessage" class="p-4 bg-red-100 text-red-700 rounded mb-4">
      {{ errorMessage }}
    </div>
    
    <div v-else-if="successMessage" class="p-4 bg-green-100 text-green-700 rounded mb-4">
      {{ successMessage }}
    </div>
    
    <div v-else-if="questionnaire && questions.length > 0" class="questionnaire-container">
      <!-- Questionnaire Header -->
      <div class="mb-6">
        <h2 class="text-2xl font-bold mb-2">{{ questionnaire.title }}</h2>
        <p v-if="questionnaire.description" class="text-gray-600 mb-3">
          {{ questionnaire.description }}
        </p>
        
        <!-- Display header/instructions if available -->
        <div v-if="questionnaire.header" class="bg-gray-50 p-4 rounded border mt-4">
          <h3 class="text-lg font-medium mb-2">Instructions</h3>
          <div v-html="questionnaire.header" class="prose max-w-none"></div>
        </div>
      </div>
      
      <!-- Progress Bar -->
      <div class="mb-6">
        <div class="flex justify-between text-sm mb-1">
          <span>Progress</span>
          <span>{{ progress }}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2.5">
          <div class="bg-blue-600 h-2.5 rounded-full" :style="{ width: `${progress}%` }"></div>
        </div>
      </div>
      
      <!-- Questions -->
      <div class="space-y-8">
        <div 
          v-for="question in questions" 
          :key="question.question_id" 
          class="card p-5"
          :class="{'ml-8 border-l-4 border-l-blue-300': question.parentID}"
        >
          <div class="mb-3">
            <!-- Show parent question info if this is a sub-question -->
            <div v-if="question.parentID" class="text-xs text-blue-600 mb-2 flex items-center">
              <Icon name="material-symbols:subdirectory-arrow-right" class="mr-1" />
              Sub-question
            </div>
            
            <h3 class="text-lg font-medium">
              {{ question.question_text_bi }}
              <span v-if="question.is_required" class="text-red-500">*</span>
            </h3>
            <p v-if="question.question_text_bm" class="text-sm text-gray-500 mt-1">
              {{ question.question_text_bm }}
            </p>
          </div>
          
          <!-- Radio Button Options -->
          <div v-if="getQuestionOptionType(question) === 'radio' && question.options" class="mt-4">
            <div v-if="question.optionsLoading" class="p-3 text-center">
              <div class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 mr-2"></div>
              <span class="text-sm text-gray-500">Loading options...</span>
            </div>
            
            <div v-else-if="question.optionsError" class="p-3 border rounded bg-red-50 text-center">
              <p class="text-sm text-red-600 mb-2">Failed to load options</p>
              <button 
                @click="retryLoadOptions(question)"
                class="text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
            
            <div v-else-if="question.options.length === 0" class="p-3 text-center text-gray-500 italic">
              No options available for this question
            </div>
            
            <div v-else class="space-y-2">
              <div 
                v-for="option in question.options" 
                :key="option.option_id"
                class="flex items-center p-3 border rounded cursor-pointer transition-colors"
                :class="{
                  'bg-blue-50 border-blue-300': answers[question.question_id] === option.option_id,
                  'hover:bg-gray-50': !props.readOnly,
                  'opacity-60 cursor-not-allowed': props.readOnly
                }"
                @click="handleOptionSelect(question.question_id, option.option_id)"
              >
                <div class="w-6 h-6 flex items-center justify-center mr-3">
                  <div 
                    class="w-4 h-4 rounded-full border-2"
                    :class="{
                      'border-blue-500': answers[question.question_id] === option.option_id,
                      'border-gray-300': answers[question.question_id] !== option.option_id
                    }"
                  >
                    <div 
                      v-if="answers[question.question_id] === option.option_id" 
                      class="w-2 h-2 rounded-full bg-blue-500 m-auto"
                    ></div>
                  </div>
                </div>
                <div>{{ option.option_title }}</div>
              </div>
            </div>
          </div>
          
          <!-- Checkbox Options -->
          <div v-else-if="getQuestionOptionType(question) === 'checkbox' && question.options" class="mt-4">
            <div v-if="question.optionsLoading" class="p-3 text-center">
              <div class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 mr-2"></div>
              <span class="text-sm text-gray-500">Loading options...</span>
            </div>
            
            <div v-else-if="question.optionsError" class="p-3 border rounded bg-red-50 text-center">
              <p class="text-sm text-red-600 mb-2">Failed to load options</p>
              <button 
                @click="retryLoadOptions(question)"
                class="text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
            
            <div v-else-if="question.options.length === 0" class="p-3 text-center text-gray-500 italic">
              No options available for this question
            </div>
            
            <div v-else class="space-y-2">
              <div 
                v-for="option in question.options" 
                :key="option.option_id"
                class="flex items-center p-3 border rounded cursor-pointer transition-colors"
                :class="{
                  'bg-blue-50 border-blue-300': answers[question.question_id] === option.option_id,
                  'hover:bg-gray-50': !props.readOnly,
                  'opacity-60 cursor-not-allowed': props.readOnly
                }"
                @click="handleOptionSelect(question.question_id, option.option_id)"
              >
                <div class="w-6 h-6 flex items-center justify-center mr-3">
                  <div 
                    class="w-4 h-4 rounded border-2"
                    :class="{
                      'border-blue-500': answers[question.question_id] === option.option_id,
                      'border-gray-300': answers[question.question_id] !== option.option_id
                    }"
                  >
                    <div 
                      v-if="answers[question.question_id] === option.option_id" 
                      class="flex items-center justify-center"
                    >
                      <Icon name="material-symbols:check-small" class="text-blue-500" size="16" />
                    </div>
                  </div>
                </div>
                <div>{{ option.option_title }}</div>
              </div>
            </div>
          </div>
          
          <!-- Range Type (1-5 Scale) -->
          <div v-else-if="getQuestionOptionType(question) === 'range'" class="mt-4">
            <div class="flex justify-between items-center py-4">
              <div v-for="value in 5" :key="value" class="flex flex-col items-center">
                <button 
                  class="w-10 h-10 rounded-full flex items-center justify-center mb-1 transition-colors"
                  :class="{
                    'bg-blue-500 text-white': answers[question.question_id] === value,
                    'bg-gray-200 hover:bg-gray-300': answers[question.question_id] !== value,
                    'opacity-60 cursor-not-allowed': props.readOnly
                  }"
                  @click="handleOptionSelect(question.question_id, value)"
                  :disabled="props.readOnly"
                >
                  {{ value }}
                </button>
                <span class="text-xs text-gray-500">
                  {{ value === 1 ? 'Strongly Disagree' : 
                     value === 2 ? 'Disagree' : 
                     value === 3 ? 'Neutral' : 
                     value === 4 ? 'Agree' : 
                     'Strongly Agree' }}
                </span>
              </div>
            </div>
          </div>
          
          <!-- Text Type -->
          <div v-else-if="getQuestionOptionType(question) === 'text'" class="mt-4">
            <div v-if="question.optionsLoading" class="p-3 text-center">
              <div class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 mr-2"></div>
              <span class="text-sm text-gray-500">Loading options...</span>
            </div>
            
            <div v-else-if="question.optionsError" class="p-3 border rounded bg-red-50 text-center">
              <p class="text-sm text-red-600 mb-2">Failed to load options</p>
              <button 
                @click="retryLoadOptions(question)"
                class="text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
            
            <div v-else>
              <input
                type="text"
                v-model="textAnswers[question.question_id]"
                class="w-full p-3 border rounded"
                :placeholder="question.options && question.options.length > 0 ? question.options[0].option_title : 'Enter your answer here'"
                :disabled="props.readOnly"
                @input="handleTextInput(question.question_id, $event.target.value)"
              />
            </div>
          </div>
          
          <!-- Textarea Type -->
          <div v-else-if="getQuestionOptionType(question) === 'textarea'" class="mt-4">
            <div v-if="question.optionsLoading" class="p-3 text-center">
              <div class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 mr-2"></div>
              <span class="text-sm text-gray-500">Loading options...</span>
            </div>
            
            <div v-else-if="question.optionsError" class="p-3 border rounded bg-red-50 text-center">
              <p class="text-sm text-red-600 mb-2">Failed to load options</p>
              <button 
                @click="retryLoadOptions(question)"
                class="text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
            
            <div v-else>
              <textarea
                v-model="textAnswers[question.question_id]"
                class="w-full p-3 border rounded min-h-[100px]"
                :placeholder="question.options && question.options.length > 0 ? question.options[0].option_title : 'Enter your answer here'"
                :disabled="props.readOnly"
                @input="handleTextInput(question.question_id, $event.target.value)"
              ></textarea>
            </div>
          </div>
          
          <!-- Scale Options (for backward compatibility) -->
          <div v-else-if="getQuestionOptionType(question) === 'scale' && question.options" class="mt-4">
            <div v-if="question.optionsLoading" class="p-3 text-center">
              <div class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 mr-2"></div>
              <span class="text-sm text-gray-500">Loading options...</span>
            </div>
            
            <div v-else-if="question.optionsError" class="p-3 border rounded bg-red-50 text-center">
              <p class="text-sm text-red-600 mb-2">Failed to load options</p>
              <button 
                @click="retryLoadOptions(question)"
                class="text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
            
            <div v-else-if="question.options.length === 0" class="p-3 text-center text-gray-500 italic">
              No options available for this question
            </div>
            
            <div v-else class="space-y-2">
              <div 
                v-for="option in question.options" 
                :key="option.option_id"
                class="flex flex-col items-center"
              >
                <button 
                  class="w-10 h-10 rounded-full flex items-center justify-center mb-1 transition-colors"
                  :class="{
                    'bg-blue-500 text-white': answers[question.question_id] === option.option_id,
                    'bg-gray-200 hover:bg-gray-300': answers[question.question_id] !== option.option_id,
                    'opacity-60 cursor-not-allowed': props.readOnly
                  }"
                  @click="handleOptionSelect(question.question_id, option.option_id)"
                  :disabled="props.readOnly"
                >
                  {{ option.option_value }}
                </button>
                <span class="text-xs text-gray-500">{{ option.option_title }}</span>
              </div>
            </div>
          </div>
          
          <div v-else class="text-gray-500 italic">No options available for this question</div>
        </div>
      </div>
      
      <!-- Submit Button -->
      <div class="mt-8 flex justify-end gap-3">
        <rs-button 
          variant="outline" 
          @click="cancelQuestionnaire"
          :disabled="isSubmitting"
        >
          Cancel
        </rs-button>
        <rs-button 
          v-if="!props.readOnly"
          @click="submitQuestionnaire"
          :disabled="isSubmitting || !requiredQuestionsAnswered"
          :loading="isSubmitting"
        >
          Submit
        </rs-button>
      </div>
    </div>
    
    <div v-else class="text-center py-12">
      <div class="flex flex-col items-center">
        <Icon name="material-symbols:quiz-outline" size="64" class="text-gray-400 mb-4" />
        <h3 class="text-xl font-medium text-gray-600 mb-2">No Questions Available</h3>
        <p class="text-gray-500">This questionnaire doesn't have any active questions.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.questionnaire-container {
  max-width: 800px;
  margin: 0 auto;
}
</style> 