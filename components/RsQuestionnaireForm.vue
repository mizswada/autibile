<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue';

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
  },
  showQuestions: {
    type: Boolean,
    default: true
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

// New refs for conditional logic
const conditionalSubQuestions = ref({});
const loadingConditionalQuestions = ref({});

// Cache for options to avoid refetching
const optionsCache = ref({});

const progress = computed(() => {
  if (!questions.value.length) return 0;
  
  // Get all questions including conditional sub-questions
  const allQuestions = [
    ...questions.value,
    ...Object.values(conditionalSubQuestions.value).flat()
  ];
  
  const totalQuestions = allQuestions.length;
     const answeredQuestions = allQuestions.filter(q => {
     const questionId = q.question_id;
     const questionType = getQuestionOptionType(q);
     
     // For text or textarea questions, check textAnswers
     if (questionType === 'text' || questionType === 'textarea' || q.answer_type === 33) {
       return textAnswers.value[questionId] !== undefined && textAnswers.value[questionId] !== '';
     } 
     // For checkbox questions, check if array has at least one item
     else if (questionType === 'checkbox') {
       return answers.value[questionId] !== undefined && 
              Array.isArray(answers.value[questionId]) && 
              answers.value[questionId].length > 0;
     }
     // For all other question types, check answers
     else {
       return answers.value[questionId] !== undefined && answers.value[questionId] !== null;
     }
   }).length;
  
  return Math.round((answeredQuestions / totalQuestions) * 100);
});

const requiredQuestionsAnswered = computed(() => {
  // Get all questions including conditional sub-questions
  const allQuestions = [
    ...questions.value,
    ...Object.values(conditionalSubQuestions.value).flat()
  ];
  
     return allQuestions
     .filter(q => q.is_required)
     .every(q => {
       const questionId = q.question_id;
       const questionType = getQuestionOptionType(q);
       
       // For text or textarea questions, check textAnswers
       if (questionType === 'text' || questionType === 'textarea' || q.answer_type === 33) {
         return textAnswers.value[questionId] !== undefined && textAnswers.value[questionId] !== '';
       } 
       // For checkbox questions, check if array has at least one item
       else if (questionType === 'checkbox') {
         return answers.value[questionId] !== undefined && 
                Array.isArray(answers.value[questionId]) && 
                answers.value[questionId].length > 0;
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

// Watch for changes in parent question answers to trigger conditional sub-questions
watch(answers, async (newAnswers, oldAnswers) => {
  // Handle both initial changes (when oldAnswers is undefined) and subsequent changes
  if (oldAnswers) {
    // Check which parent questions have changed
    for (const [questionId, answer] of Object.entries(newAnswers)) {
      if (oldAnswers[questionId] !== answer) {
        await checkAndLoadConditionalSubQuestions(parseInt(questionId), answer);
      }
    }
  } else {
    // Handle initial changes (when oldAnswers is undefined)
    for (const [questionId, answer] of Object.entries(newAnswers)) {
      if (answer !== undefined && answer !== null) {
        await checkAndLoadConditionalSubQuestions(parseInt(questionId), answer);
      }
    }
  }
}, { deep: true });

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
  
  // Clear options cache when loading new questions
  clearOptionsCache();
  
  isLoading.value = true;
  try {
    // First fetch all questions for this questionnaire
    const res = await fetch(`/api/questionnaire/questions/listQuestions?questionnaireID=${props.questionnaireId}&status=Active`);
    const result = await res.json();

    if (res.ok && result.data) {
      // Only show parent questions initially (no sub-questions shown by default)
      const parentQuestions = result.data.filter(q => q.parentID === null);
      
      // Initialize questions without setting optionsLoading initially
      questions.value = parentQuestions.map(q => {
        return {
          ...q,
          options: [],
          optionsLoading: false, // Don't set loading initially
          optionsError: false
        };
      });
      
      // Fetch options only for questions that need them
      const questionsNeedingOptions = questions.value.filter(q => q.answer_type === 35);
      
      if (questionsNeedingOptions.length > 0) {
        const batchSize = 5;
        for (let i = 0; i < questionsNeedingOptions.length; i += batchSize) {
          const batch = questionsNeedingOptions.slice(i, i + batchSize);
          await Promise.all(batch.map(question => fetchQuestionOptions(question)));
        }
      }
      
      // Set loading to false for questions that don't have conditional_sub_questions_ids
      questions.value.forEach(question => {
        if (question.answer_type === 35) {
          // If no conditional sub-questions, set loading to false immediately
          if (!hasConditionalSubQuestions(question)) {
            question.optionsLoading = false;
          }
        }
      });
      
      // Don't load sub-questions by default - only show them when options are selected
      // The sub-questions will be loaded dynamically when users select options
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

// New function to load sub-questions for a parent question
async function loadSubQuestionsForParent(parentQuestionId) {
  try {
    // Get all sub-questions for this parent - use a special parameter to indicate we want all sub-questions
    const url = `/api/questionnaire/questions/getConditionalSubQuestions?questionnaireID=${props.questionnaireId}&parentQuestionID=${parentQuestionId}&showAllSubQuestions=true`;
    
    const res = await fetch(url);
    const result = await res.json();

    if (res.ok && result.data && result.data.length > 0) {
      // Get the sub-question IDs to fetch their options efficiently
      const subQuestionIds = result.data.map(q => q.question_id);
      
      // Use batch API to fetch options for all sub-questions at once
      const batchRes = await fetch(`/api/questionnaire/questions/options/batch?questionIDs=${subQuestionIds.join(',')}`);
      const batchResult = await batchRes.json();
      
      // Process the sub-questions with options from batch API
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
      
      // Use Vue's reactive system properly
      conditionalSubQuestions.value = {
        ...conditionalSubQuestions.value,
        [parentQuestionId]: subQuestions
      };
      
      // Ensure DOM updates
      await nextTick();
    } else {
      // Set empty array to ensure the key exists
      conditionalSubQuestions.value = {
        ...conditionalSubQuestions.value,
        [parentQuestionId]: []
      };
    }
  } catch (err) {
    // Set empty array on error too
    conditionalSubQuestions.value = {
      ...conditionalSubQuestions.value,
      [parentQuestionId]: []
    };
  }
}

// New function to check and load conditional sub-questions
async function checkAndLoadConditionalSubQuestions(parentQuestionId, selectedAnswer) {
  
  // Get the selected option to find its value
  const parentQuestion = questions.value.find(q => q.question_id === parentQuestionId);
  
  const selectedOption = parentQuestion.options.find(option => 
    option.option_id === selectedAnswer
  );

  if (!selectedOption) {
    return;
  }

  // Check if this option has conditional logic configured
  const hasConditionalLogic = selectedOption.conditional_sub_questions_ids && 
    JSON.parse(selectedOption.conditional_sub_questions_ids || '[]').length > 0;
  
  // Only set loading state if there are sub-questions to load
  if (hasConditionalLogic) {
    loadingConditionalQuestions.value[parentQuestionId] = true;
  }

  try {
    if (hasConditionalLogic) {
      // Use conditional logic - fetch specific sub-questions for this option
      const res = await fetch(`/api/questionnaire/questions/getConditionalSubQuestions?questionnaireID=${props.questionnaireId}&parentQuestionID=${parentQuestionId}&selectedOptionValue=${selectedOption.option_value}`);
      const result = await res.json();

      if (res.ok && result.data && result.data.length > 0) {
        // Get the sub-question IDs to fetch their options efficiently
        const subQuestionIds = result.data.map(q => q.question_id);
        
        // Use batch API to fetch options for all sub-questions at once
        const batchRes = await fetch(`/api/questionnaire/questions/options/batch?questionIDs=${subQuestionIds.join(',')}`);
        const batchResult = await batchRes.json();
        
        // Process the conditional sub-questions with options from batch API
        const conditionalQuestions = result.data.map(q => {
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
        
        // Use Vue's reactive system properly
        conditionalSubQuestions.value = {
          ...conditionalSubQuestions.value,
          [parentQuestionId]: conditionalQuestions
        };
        
        // Ensure DOM updates
        await nextTick();
      } else {
        // If API returns empty data, clear the sub-questions
        conditionalSubQuestions.value[parentQuestionId] = [];
      }
    } else {
      // No conditional logic - show all sub-questions by default
      const res = await fetch(`/api/questionnaire/questions/getConditionalSubQuestions?questionnaireID=${props.questionnaireId}&parentQuestionID=${parentQuestionId}&showAllSubQuestions=true`);
      const result = await res.json();

      if (res.ok && result.data && result.data.length > 0) {
        // Get the sub-question IDs to fetch their options efficiently
        const subQuestionIds = result.data.map(q => q.question_id);
        
        // Use batch API to fetch options for all sub-questions at once
        const batchRes = await fetch(`/api/questionnaire/questions/options/batch?questionIDs=${subQuestionIds.join(',')}`);
        const batchResult = await batchRes.json();
        
        // Process the sub-questions with options from batch API
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
        
        // Use Vue's reactive system properly
        conditionalSubQuestions.value = {
          ...conditionalSubQuestions.value,
          [parentQuestionId]: subQuestions
        };
        
        // Ensure DOM updates
        await nextTick();
      } else {
        // If API returns empty data, clear the sub-questions
        conditionalSubQuestions.value[parentQuestionId] = [];
      }
    }
  } catch (err) {
    console.error('Error loading conditional sub-questions:', err);
    conditionalSubQuestions.value[parentQuestionId] = [];
  } finally {
    // Clear loading state
    loadingConditionalQuestions.value[parentQuestionId] = false;
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
  
  // Make sure to remove any type of prefix in square brackets
  return optionTitle
    .replace(/^\[(radio|checkbox|scale|text|textarea)\]/, '')
    .trim();
}

// Helper function to check if a question has conditional sub-questions
function hasConditionalSubQuestions(question) {
  if (!question.options || question.options.length === 0) {
    return false;
  }
  
  return question.options.some(option => {
    return option.conditional_sub_questions_ids && 
           JSON.parse(option.conditional_sub_questions_ids || '[]').length > 0;
  });
}

async function fetchQuestionOptions(question) {
  
  // Check cache first
  if (optionsCache.value[question.question_id] !== undefined) {
    question.options = optionsCache.value[question.question_id];
    question.optionsLoading = false;
    question.optionsError = false;
    return;
  }
  
  
  // Set loading only when we're actually fetching
  question.optionsLoading = true;
  question.optionsError = false;
  
  try {
    const url = `/api/questionnaire/questions/options/list?questionID=${question.question_id}`;
    
    const res = await fetch(url, {
      // Add cache control to prevent browser caching
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    const result = await res.json();

    if (res.ok && result.data) {
      
      // Check if there are any options
      if (result.data.length === 0) {
        question.options = [];
        // Cache the empty array to avoid refetching
        optionsCache.value[question.question_id] = [];
        question.optionsLoading = false;
        question.optionsError = false;
        return;
      }
      
      // Process options to extract type from title and include conditional logic data
      const processedOptions = result.data.map(option => ({
        ...option,
        option_type: extractOptionType(option.option_title),
        original_title: option.option_title,
        option_title: cleanOptionTitle(option.option_title),
        conditional_sub_questions_ids: option.conditional_sub_questions_ids // Include conditional logic field
      }));
      
      // Cache the processed options (including empty arrays)
      optionsCache.value[question.question_id] = processedOptions;
      
      question.options = processedOptions;
      
      // Set loading to false (for questions without conditional sub-questions, this happens immediately)
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

// Function to clear options cache
function clearOptionsCache() {
  optionsCache.value = {};
}

function handleOptionSelect(questionId, optionId) {
  
  if (props.readOnly) return;
  
  // Check if this is a conditional sub-question
  const isConditionalQuestion = Object.values(conditionalSubQuestions.value).flat().some(q => q.question_id === questionId);
  
  // Get the question (either from main questions or conditional sub-questions)
  let targetQuestion;
  if (isConditionalQuestion) {
    targetQuestion = Object.values(conditionalSubQuestions.value).flat().find(q => q.question_id === questionId);
  } else {
    targetQuestion = questions.value.find(q => q.question_id === questionId);
  }
  
  const selectedOption = targetQuestion.options.find(option => 
    option.option_id === optionId
  );
  
  // Get the question type to determine if it's radio or checkbox
  const questionType = getQuestionOptionType(targetQuestion);
  
  if (questionType === 'checkbox') {
    // For checkbox: toggle the option in an array
    if (!answers.value[questionId]) {
      answers.value[questionId] = [];
    }
    
    const currentAnswers = Array.isArray(answers.value[questionId]) ? answers.value[questionId] : [];
    
    if (currentAnswers.includes(optionId)) {
      // Remove option if already selected
      answers.value[questionId] = currentAnswers.filter(id => id !== optionId);
    } else {
      // Add option if not selected
      answers.value[questionId] = [...currentAnswers, optionId];
    }
    
    // For conditional sub-questions, we don't need to trigger additional conditional logic
    if (!isConditionalQuestion) {
      // For checkbox, we need to determine which option to use for conditional logic
      // Use the first selected option for conditional logic
      const firstSelectedOptionId = Array.isArray(answers.value[questionId]) && answers.value[questionId].length > 0 
        ? answers.value[questionId][0] 
        : null;
      
      if (firstSelectedOptionId) {
        checkAndLoadConditionalSubQuestions(questionId, firstSelectedOptionId);
      } else {
        // Clear sub-questions if no options selected
        conditionalSubQuestions.value[questionId] = [];
      }
    }
  } else {
    // For radio and other types: single selection
    // Clear existing sub-questions when changing answers (only for main questions)
    if (!isConditionalQuestion && answers.value[questionId] !== optionId) {
      conditionalSubQuestions.value[questionId] = [];
    }
    
    answers.value[questionId] = optionId;
    
    // Always call conditional function to handle both conditional and default sub-questions (only for main questions)
    if (!isConditionalQuestion) {
      checkAndLoadConditionalSubQuestions(questionId, optionId);
    }
  }
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
    const result = question.options[0].option_type || 'radio';
    
    return result;
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
         const questionType = getQuestionOptionType(question);
         
         if (questionType === 'checkbox' && Array.isArray(answers.value[questionId])) {
           // For checkbox: create multiple answers
           answers.value[questionId].forEach(optionId => {
             formattedAnswers.push({
               question_id: parseInt(questionId),
               option_id: parseInt(optionId),
               patient_id: props.patientId ? parseInt(props.patientId) : null,
               parentID: parentID ? parseInt(parentID) : null // Include parentID if it exists
             });
           });
         } else if (answers.value[questionId]) {
           // For radio and other single-selection types
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

    // Also include conditional sub-questions answers
    Object.values(conditionalSubQuestions.value).flat().forEach(question => {
      const questionId = question.question_id;
      const answerType = question.answer_type;
      const parentID = question.parentID;
      const questionType = getQuestionOptionType(question);
      
      // Handle Text Type
      if (answerType === 33 || questionType === 'text' || questionType === 'textarea') {
        if (textAnswers.value[questionId]) {
          formattedAnswers.push({
            question_id: parseInt(questionId),
            option_id: null,
            text_answer: textAnswers.value[questionId],
            patient_id: props.patientId ? parseInt(props.patientId) : null,
            parentID: parentID ? parseInt(parentID) : null
          });
        }
      }
      // Handle Option Type (answer_type = 35) for conditional sub-questions
      else if (answerType === 35) {
        const questionType = getQuestionOptionType(question);
        
        if (questionType === 'checkbox' && Array.isArray(answers.value[questionId])) {
          // For checkbox: create multiple answers
          answers.value[questionId].forEach(optionId => {
            formattedAnswers.push({
              question_id: parseInt(questionId),
              option_id: parseInt(optionId),
              patient_id: props.patientId ? parseInt(props.patientId) : null,
              parentID: parentID ? parseInt(parentID) : null
            });
          });
        } else if (answers.value[questionId]) {
          // For radio and other single-selection types
          formattedAnswers.push({
            question_id: parseInt(questionId),
            option_id: parseInt(answers.value[questionId]),
            patient_id: props.patientId ? parseInt(props.patientId) : null,
            parentID: parentID ? parseInt(parentID) : null
          });
        }
      }
      // Handle other types (fallback)
      else if (answers.value[questionId]) {
        formattedAnswers.push({
          question_id: parseInt(questionId),
          option_id: parseInt(answers.value[questionId]),
          patient_id: props.patientId ? parseInt(props.patientId) : null,
          parentID: parentID ? parseInt(parentID) : null
        });
      }
    });

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
       <div v-if="props.showQuestions" class="space-y-8">
        
        <div 
          v-for="question in questions" 
          :key="question.question_id" 
          class="card p-5"
          :class="{'ml-8 border-l-4 border-l-blue-300': question.parentID}"
        >
          <div class="mb-3">
            <!-- Show parent question info if this is a sub-question -->
            <div v-if="question.parentID" class="text-xs text-blue-600 mb-2 flex items-center">
              <Icon name="ic:outline-subdirectory-arrow-right" class="mr-1" />
              Sub-question
            </div>
            
            <h3 class="text-lg font-medium">
              {{ question.question_text_bi || question.question_text }}
              <span v-if="question.is_required" class="text-red-500">*</span>
            </h3>
            <p v-if="question.question_text_bm" class="text-sm text-gray-500 mt-1">
              {{ question.question_text_bm }}
            </p>
          </div>
          
          <!-- Radio Button Options -->
          <div v-if="getQuestionOptionType(question) === 'radio' && question.answer_type === 35" class="mt-4">
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
            
            <div v-else-if="!question.options || question.options.length === 0" class="p-3 text-center text-gray-500 italic">
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
          <div v-else-if="getQuestionOptionType(question) === 'checkbox' && question.answer_type === 35" class="mt-4">
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
            
            <div v-else-if="!question.options || question.options.length === 0" class="p-3 text-center text-gray-500 italic">
              No options available for this question
            </div>
            
            <div v-else class="space-y-2">
              <div 
                v-for="option in question.options" 
                :key="option.option_id"
                class="flex items-center p-3 border rounded cursor-pointer transition-colors"
                :class="{
                  'bg-blue-50 border-blue-300': Array.isArray(answers[question.question_id]) 
                    ? answers[question.question_id].includes(option.option_id)
                    : answers[question.question_id] === option.option_id,
                  'hover:bg-gray-50': !props.readOnly,
                  'opacity-60 cursor-not-allowed': props.readOnly
                }"
                @click="handleOptionSelect(question.question_id, option.option_id)"
              >
                <div class="w-6 h-6 flex items-center justify-center mr-3">
                  <div 
                    class="w-4 h-4 rounded border-2"
                    :class="{
                      'border-blue-500': Array.isArray(answers[question.question_id]) 
                        ? answers[question.question_id].includes(option.option_id)
                        : answers[question.question_id] === option.option_id,
                      'border-gray-300': Array.isArray(answers[question.question_id]) 
                        ? !answers[question.question_id].includes(option.option_id)
                        : answers[question.question_id] !== option.option_id
                    }"
                  >
                    <div 
                      v-if="Array.isArray(answers[question.question_id]) 
                        ? answers[question.question_id].includes(option.option_id)
                        : answers[question.question_id] === option.option_id" 
                      class="flex items-center justify-center"
                    >
                      <Icon name="ic:outline-check" class="text-blue-500" size="16" />
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
            <input
              type="text"
              v-model="textAnswers[question.question_id]"
              class="w-full p-3 border rounded"
              :placeholder="question.options && question.options.length > 0 ? question.options[0].option_title : 'Enter your answer here'"
              :disabled="props.readOnly"
              @input="handleTextInput(question.question_id, $event.target.value)"
            />
          </div>
          
          <!-- Textarea Type -->
          <div v-else-if="getQuestionOptionType(question) === 'textarea'" class="mt-4">
            <textarea
              v-model="textAnswers[question.question_id]"
              class="w-full p-3 border rounded min-h-[100px]"
              :placeholder="question.options && question.options.length > 0 ? question.options[0].option_title : 'Enter your answer here'"
              :disabled="props.readOnly"
              @input="handleTextInput(question.question_id, $event.target.value)"
            ></textarea>
          </div>
          
          <!-- Scale Options (for backward compatibility) -->
          <div v-else-if="getQuestionOptionType(question) === 'scale' && question.answer_type === 35" class="mt-4">
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
            
            <div v-else-if="!question.options || question.options.length === 0" class="p-3 text-center text-gray-500 italic">
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
          
          <!-- Loading indicator for conditional questions for this specific question -->
          <div v-if="loadingConditionalQuestions[question.question_id]" class="card p-5 ml-8 border-l-4 border-l-green-300 bg-green-50 mt-4">
            <div class="flex items-center justify-center">
              <div class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-green-500 mr-2"></div>
              <span class="text-sm text-gray-500">Loading conditional questions...</span>
            </div>
          </div>

          <!-- Conditional Sub-Questions for this specific question -->
          <template v-if="conditionalSubQuestions[question.question_id] && conditionalSubQuestions[question.question_id].length > 0">
            <div 
              v-for="conditionalQuestion in conditionalSubQuestions[question.question_id]" 
              :key="conditionalQuestion.question_id" 
              class="card p-5 ml-8 border-l-4 border-l-green-300 bg-green-50 mt-4"
            >
              <div class="mb-3">
                <div class="text-xs text-green-600 mb-2 flex items-center">
                  <Icon name="ic:outline-subdirectory-arrow-right" class="mr-1" />
                  Sub-question
                </div>
                
                <h3 class="text-lg font-medium">
                  {{ conditionalQuestion.question_text_bi || conditionalQuestion.question_text }}
                  <span v-if="conditionalQuestion.is_required" class="text-red-500">*</span>
                </h3>
                <p v-if="conditionalQuestion.question_text_bm" class="text-sm text-gray-500 mt-1">
                  {{ conditionalQuestion.question_text_bm }}
                </p>
              </div>
              
              <!-- Radio Button Options for Conditional Questions -->
              <div v-if="getQuestionOptionType(conditionalQuestion) === 'radio' && conditionalQuestion.options" class="mt-4">
                <div v-if="conditionalQuestion.optionsLoading" class="p-3 text-center">
                  <div class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 mr-2"></div>
                  <span class="text-sm text-gray-500">Loading options...</span>
                </div>
                
                <div v-else-if="conditionalQuestion.optionsError" class="p-3 border rounded bg-red-50 text-center">
                  <p class="text-sm text-red-600 mb-2">Failed to load options</p>
                  <button 
                    @click="retryLoadOptions(conditionalQuestion)"
                    class="text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Retry
                  </button>
                </div>
                
                <div v-else-if="conditionalQuestion.options.length === 0" class="p-3 text-center text-gray-500 italic">
                  No options available for this question
                </div>
                
                <div v-else class="space-y-2">
                  <div 
                    v-for="option in conditionalQuestion.options" 
                    :key="option.option_id"
                    class="flex items-center p-3 border rounded cursor-pointer transition-colors"
                    :class="{
                      'bg-blue-50 border-blue-300': answers[conditionalQuestion.question_id] === option.option_id,
                      'hover:bg-gray-50': !props.readOnly,
                      'opacity-60 cursor-not-allowed': props.readOnly
                    }"
                    @click="handleOptionSelect(conditionalQuestion.question_id, option.option_id)"
                  >
                    <div class="w-6 h-6 flex items-center justify-center mr-3">
                      <div 
                        class="w-4 h-4 rounded-full border-2"
                        :class="{
                          'border-blue-500': answers[conditionalQuestion.question_id] === option.option_id,
                          'border-gray-300': answers[conditionalQuestion.question_id] !== option.option_id
                        }"
                      >
                        <div 
                          v-if="answers[conditionalQuestion.question_id] === option.option_id" 
                          class="w-2 h-2 rounded-full bg-blue-500 m-auto"
                        ></div>
                      </div>
                    </div>
                    <div>{{ option.option_title }}</div>
                  </div>
                </div>
              </div>
              
              <!-- Checkbox Options for Conditional Questions -->
              <div v-else-if="getQuestionOptionType(conditionalQuestion) === 'checkbox' && conditionalQuestion.options" class="mt-4">
                <div v-if="conditionalQuestion.optionsLoading" class="p-3 text-center">
                  <div class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 mr-2"></div>
                  <span class="text-sm text-gray-500">Loading options...</span>
                </div>
                
                <div v-else-if="conditionalQuestion.optionsError" class="p-3 border rounded bg-red-50 text-center">
                  <p class="text-sm text-red-600 mb-2">Failed to load options</p>
                  <button 
                    @click="retryLoadOptions(conditionalQuestion)"
                    class="text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Retry
                  </button>
                </div>
                
                <div v-else-if="conditionalQuestion.options.length === 0" class="p-3 text-center text-gray-500 italic">
                  No options available for this question
                </div>
                
                <div v-else class="space-y-2">
                  <div 
                    v-for="option in conditionalQuestion.options" 
                    :key="option.option_id"
                    class="flex items-center p-3 border rounded cursor-pointer transition-colors"
                    :class="{
                      'bg-blue-50 border-blue-300': Array.isArray(answers[conditionalQuestion.question_id]) 
                        ? answers[conditionalQuestion.question_id].includes(option.option_id)
                        : answers[conditionalQuestion.question_id] === option.option_id,
                      'hover:bg-gray-50': !props.readOnly,
                      'opacity-60 cursor-not-allowed': props.readOnly
                    }"
                    @click="handleOptionSelect(conditionalQuestion.question_id, option.option_id)"
                  >
                    <div class="w-6 h-6 flex items-center justify-center mr-3">
                      <div 
                        class="w-4 h-4 rounded border-2"
                        :class="{
                          'border-blue-500': Array.isArray(answers[conditionalQuestion.question_id]) 
                            ? answers[conditionalQuestion.question_id].includes(option.option_id)
                            : answers[conditionalQuestion.question_id] === option.option_id,
                          'border-gray-300': Array.isArray(answers[conditionalQuestion.question_id]) 
                            ? !answers[conditionalQuestion.question_id].includes(option.option_id)
                            : answers[conditionalQuestion.question_id] !== option.option_id
                        }"
                      >
                        <div 
                          v-if="Array.isArray(answers[conditionalQuestion.question_id]) 
                            ? answers[conditionalQuestion.question_id].includes(option.option_id)
                            : answers[conditionalQuestion.question_id] === option.option_id" 
                          class="flex items-center justify-center"
                        >
                          <Icon name="ic:outline-check" class="text-blue-500" size="16" />
                        </div>
                      </div>
                    </div>
                    <div>{{ option.option_title }}</div>
                  </div>
                </div>
              </div>
              
              <!-- Text Type for Conditional Questions -->
              <div v-else-if="getQuestionOptionType(conditionalQuestion) === 'text'" class="mt-4">
                <input
                  type="text"
                  v-model="textAnswers[conditionalQuestion.question_id]"
                  class="w-full p-3 border rounded"
                  :placeholder="conditionalQuestion.options && conditionalQuestion.options.length > 0 ? conditionalQuestion.options[0].option_title : 'Enter your answer here'"
                  :disabled="props.readOnly"
                  @input="handleTextInput(conditionalQuestion.question_id, $event.target.value)"
                />
              </div>
              
              <!-- Textarea Type for Conditional Questions -->
              <div v-else-if="getQuestionOptionType(conditionalQuestion) === 'textarea'" class="mt-4">
                <textarea
                  v-model="textAnswers[conditionalQuestion.question_id]"
                  class="w-full p-3 border rounded min-h-[100px]"
                  :placeholder="conditionalQuestion.options && conditionalQuestion.options.length > 0 ? conditionalQuestion.options[0].option_title : 'Enter your answer here'"
                  :disabled="props.readOnly"
                  @input="handleTextInput(conditionalQuestion.question_id, $event.target.value)"
                ></textarea>
              </div>
              
              <div v-else class="text-gray-500 italic">No options available for this question</div>
            </div>
          </template>
          

        </div>
      </div>
      
      <!-- Submit Button -->
      <div v-if="props.showQuestions" class="mt-8 flex justify-end gap-3">
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
        <Icon name="ic:outline-quiz" size="64" class="text-gray-400 mb-4" />
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