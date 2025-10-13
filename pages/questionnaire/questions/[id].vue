<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const questionnaireId = route.params.id;

// Function to check if the current questionnaire is protected
const isProtectedQuestionnaire = computed(() => {
  return questionnaireId === '1';
});

const questionnaire = ref(null);
const questions = ref([]);
const isLoading = ref(true);
const showQuestionModal = ref(false);
const showHeaderModal = ref(false);
const newQuestion = ref({
  question_bm: '',
  question_en: '',
  requiredQuestion: '',
  status: ''
});
const isEditingQuestion = ref(false);
const editQuestionId = ref(null);
const message = ref('');
const messageType = ref('success');
const modalErrorMessage = ref('');
const showSearchForm = ref(false);
const searchResults = ref([]);
const isSearching = ref(false);
const searchQuery = ref('');
const headerContent = ref('');

// For status toggle
const showConfirmToggleModal = ref(false);
const pendingToggleQuestion = ref(null);
const isTogglingStatus = ref(false);
const answerTypeOptions = ref([]);

// Add these new refs for sub-questions handling
const showingSubQuestions = ref({});
const loadingSubQuestions = ref({});
const subQuestions = ref({});
const addingSubQuestionFor = ref(null);

// Add refs for delete functionality
const showDeleteModal = ref(false);
const pendingDeleteQuestion = ref(null);
const isDeleting = ref(false);

async function fetchAnswerTypes() {
  try {
    const res = await fetch('/api/questionnaire/questions/lookupAnswer');
    const result = await res.json();
    
    if (res.ok && result.data) {
      answerTypeOptions.value = result.data.map(type => ({
        label: type.title,
        value: type.lookupID.toString()
      }));
    } else {
      console.error('Failed to load answer types:', result.message);
    }
  } catch (err) {
    console.error('Error fetching answer types:', err);
  }
}


function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => {
    message.value = '';
  }, 3000);
}

onMounted(async () => {
  await fetchQuestionnaireData();
  await fetchAnswerTypes();
  
  // Ensure nested sub-questions are loaded
  setTimeout(async () => {
    await loadAllNestedSubQuestions();
  }, 1000);
});

async function fetchQuestionnaireData() {
  isLoading.value = true;
  try {
    const res = await fetch('/api/questionnaire/listQuestionnaires');
    const result = await res.json();

    if (res.ok && result.data) {
      const found = result.data.find(q => q.questionnaire_id === parseInt(questionnaireId));
      
      if (found) {
        questionnaire.value = {
          id: found.questionnaire_id,
          name: found.title,
          description: found.description,
          header: found.header || '',
          status: found.status
        };
        
        headerContent.value = found.header || '';
        await fetchQuestions();
      } else {
        showMessage('Questionnaire not found', 'error');
        router.push('/questionnaire');
      }
    } else {
      showMessage('Failed to load autism screening data', 'error');
    }
  } catch (err) {
          console.error('Error loading autism screening data:', err);
      showMessage('Error loading autism screening data', 'error');
  } finally {
    isLoading.value = false;
  }
}

async function fetchQuestions() {
  isLoading.value = true;
  try {
    // Default to fetching top-level questions (parentID is null)
    const res = await fetch(`/api/questionnaire/questions/listQuestions?questionnaireID=${questionnaireId}&parentID=null`);
    const result = await res.json();

    if (res.ok && result.data) {
      questions.value = result.data.map(q => ({
        id: q.question_id,
        question_text_bi: q.question_text_bi,
        question_text_bm: q.question_text_bm,
        is_required: q.is_required,
        status: q.status,
        questionnaire_id: q.questionnaire_id,
        answer_type: q.answer_type,
        has_sub_questions: q.has_sub_questions,
        sub_questions_count: q.sub_questions_count,
        parentID: q.parentID
      }));
    } else {
      console.error('Failed to load questions:', result.message);
    }
  } catch (err) {
    console.error('Error loading questions:', err);
  } finally {
    isLoading.value = false;
  }
}

async function fetchSubQuestions(parentQuestionId, forceShow = false) {
  console.log(`📡 fetchSubQuestions called for ${parentQuestionId} with forceShow=${forceShow}`);
  
  if (!showingSubQuestions.value[parentQuestionId] || forceShow) {
    console.log(`📡 Setting showingSubQuestions[${parentQuestionId}] = true`);
    
    // Use spread to ensure reactivity
    showingSubQuestions.value = { 
      ...showingSubQuestions.value, 
      [parentQuestionId]: true 
    };
    
    loadingSubQuestions.value[parentQuestionId] = true;
    
    try {
      console.log(`🔄 Loading sub-questions for parent ${parentQuestionId}...`);
      const res = await fetch(`/api/questionnaire/questions/listQuestions?questionnaireID=${questionnaireId}&parentID=${parentQuestionId}`);
      const result = await res.json();

      if (res.ok && result.data) {
        console.log(`✅ Found ${result.data.length} sub-questions for parent ${parentQuestionId}`);
        
        // Use spread to ensure reactivity
        subQuestions.value = {
          ...subQuestions.value,
          [parentQuestionId]: result.data.map(q => ({
            id: q.question_id,
            question_text_bi: q.question_text_bi,
            question_text_bm: q.question_text_bm,
            is_required: q.is_required,
            status: q.status,
            questionnaire_id: q.questionnaire_id,
            answer_type: q.answer_type,
            has_sub_questions: q.has_sub_questions,
            sub_questions_count: q.sub_questions_count,
            parentID: q.parentID
          }))
        };
        
        // Pre-fetch nested sub-questions for any sub-questions that have them
        const nestedFetches = [];
        
        if (subQuestions.value[parentQuestionId]) {
          for (const subQuestion of subQuestions.value[parentQuestionId]) {
            if (subQuestion && subQuestion.has_sub_questions && subQuestion.sub_questions_count > 0) {
              console.log(`🔍 Found sub-question ${subQuestion.id} with ${subQuestion.sub_questions_count} nested sub-questions`);
              
              // Create a promise for this fetch
              const fetchPromise = fetch(`/api/questionnaire/questions/listQuestions?questionnaireID=${questionnaireId}&parentID=${subQuestion.id}`)
                .then(nestedRes => nestedRes.json())
                .then(nestedResult => {
                  if (nestedResult.data && nestedResult.data.length > 0) {
                    console.log(`✅ Pre-fetched ${nestedResult.data.length} nested sub-questions for ${subQuestion.id}`);
                    
                    // Use spread to ensure reactivity
                    subQuestions.value = {
                      ...subQuestions.value,
                      [subQuestion.id]: nestedResult.data.map(q => ({
                        id: q.question_id,
                        question_text_bi: q.question_text_bi,
                        question_text_bm: q.question_text_bm,
                        is_required: q.is_required,
                        status: q.status,
                        questionnaire_id: q.questionnaire_id,
                        answer_type: q.answer_type,
                        has_sub_questions: q.has_sub_questions,
                        sub_questions_count: q.sub_questions_count,
                        parentID: q.parentID
                      }))
                    };
                    
                    // Don't set showingSubQuestions for nested questions yet
                    // They will be shown when the user clicks on their parent's chevron
                  }
                })
                .catch(err => console.error(`Error pre-fetching nested sub-questions for ${subQuestion.id}:`, err));
              
              nestedFetches.push(fetchPromise);
            }
          }
        }
        
        // Wait for all nested fetches to complete
        await Promise.all(nestedFetches);
      } else {
        console.error('Failed to load sub-questions:', result.message);
        subQuestions.value = { ...subQuestions.value, [parentQuestionId]: [] };
      }
    } catch (err) {
      console.error('Error loading sub-questions:', err);
      subQuestions.value = { ...subQuestions.value, [parentQuestionId]: [] };
    } finally {
      loadingSubQuestions.value[parentQuestionId] = false;
      
      // Force reactivity update one more time
      showingSubQuestions.value = { ...showingSubQuestions.value };
      
      console.log(`📡 Final state - showingSubQuestions[${parentQuestionId}]:`, showingSubQuestions.value[parentQuestionId]);
      console.log(`📡 Final state - subQuestions[${parentQuestionId}]:`, subQuestions.value[parentQuestionId]);
    }
  } else {
    // Hide sub-questions if they're already showing and not forcing to show
    console.log(`📡 Hiding sub-questions for ${parentQuestionId}`);
    showingSubQuestions.value = { 
      ...showingSubQuestions.value, 
      [parentQuestionId]: false 
    };
  }
}

async function toggleSubQuestions(questionId) {
  console.log(`🔄 Toggle sub-questions for question ${questionId}`);
  
  if (!showingSubQuestions.value[questionId]) {
    // Expanding sub-questions
    console.log(`📥 Expanding sub-questions for ${questionId}`);
    
    // Update showing state first
    showingSubQuestions.value = { 
      ...showingSubQuestions.value, 
      [questionId]: true 
    };
    
    // Set loading state
    loadingSubQuestions.value = {
      ...loadingSubQuestions.value,
      [questionId]: true
    };
    
    try {
      // Always fetch fresh data to ensure we have the latest
      console.log(`📥 Fetching sub-questions for ${questionId}...`);
      const res = await fetch(`/api/questionnaire/questions/listQuestions?questionnaireID=${questionnaireId}&parentID=${questionId}`);
      const result = await res.json();
      
      if (res.ok && result.data) {
        // Process sub-questions
        const processedSubQuestions = result.data.map(q => ({
          id: q.question_id,
          question_text_bi: q.question_text_bi,
          question_text_bm: q.question_text_bm,
          is_required: q.is_required,
          status: q.status,
          questionnaire_id: q.questionnaire_id,
          answer_type: q.answer_type,
          has_sub_questions: q.has_sub_questions,
          sub_questions_count: q.sub_questions_count,
          parentID: q.parentID
        }));
        
        // Update the subQuestions state
        subQuestions.value = {
          ...subQuestions.value,
          [questionId]: processedSubQuestions
        };
        
        console.log(`✅ Loaded ${processedSubQuestions.length} sub-questions for ${questionId}`);
        
        // Pre-fetch nested sub-questions for any sub-questions that have them
        if (processedSubQuestions.length > 0) {
          for (const subQ of processedSubQuestions) {
            if (subQ && subQ.has_sub_questions && subQ.sub_questions_count > 0) {
              console.log(`🔍 Found sub-question ${subQ.id} with ${subQ.sub_questions_count} nested sub-questions`);
              
              try {
                const nestedRes = await fetch(`/api/questionnaire/questions/listQuestions?questionnaireID=${questionnaireId}&parentID=${subQ.id}`);
                const nestedResult = await nestedRes.json();
                
                if (nestedRes.ok && nestedResult.data && nestedResult.data.length > 0) {
                  console.log(`✅ Loaded ${nestedResult.data.length} nested sub-questions for ${subQ.id}`);
                  
                  // Process nested sub-questions
                  const processedNestedSubQuestions = nestedResult.data.map(q => ({
                    id: q.question_id,
                    question_text_bi: q.question_text_bi,
                    question_text_bm: q.question_text_bm,
                    is_required: q.is_required,
                    status: q.status,
                    questionnaire_id: q.questionnaire_id,
                    answer_type: q.answer_type,
                    has_sub_questions: q.has_sub_questions,
                    sub_questions_count: q.sub_questions_count,
                    parentID: q.parentID
                  }));
                  
                  // Update the subQuestions state for nested sub-questions
                  subQuestions.value = {
                    ...subQuestions.value,
                    [subQ.id]: processedNestedSubQuestions
                  };
                  
                  // Initialize showing state for nested sub-questions (initially not shown)
                  showingSubQuestions.value = {
                    ...showingSubQuestions.value,
                    [subQ.id]: false
                  };
                }
              } catch (err) {
                console.error(`Error loading nested sub-questions for ${subQ.id}:`, err);
              }
            }
          }
        }
      } else {
        console.error('Failed to load sub-questions:', result.message);
        subQuestions.value = { 
          ...subQuestions.value, 
          [questionId]: [] 
        };
      }
    } catch (err) {
      console.error('Error in toggleSubQuestions:', err);
      subQuestions.value = { 
        ...subQuestions.value, 
        [questionId]: [] 
      };
    } finally {
      // Clear loading state
      loadingSubQuestions.value = {
        ...loadingSubQuestions.value,
        [questionId]: false
      };
      
      
      console.log(`📊 FINAL STATE - showingSubQuestions:`, showingSubQuestions.value);
      console.log(`📊 FINAL STATE - subQuestions keys:`, Object.keys(subQuestions.value));
    }
  } else {
    // Collapsing sub-questions
    console.log(`📤 Collapsing sub-questions for ${questionId}`);
    showingSubQuestions.value = { 
      ...showingSubQuestions.value, 
      [questionId]: false 
    };
  }
}

// Function to specifically toggle nested sub-questions
async function toggleNestedSubQuestions(subQuestionId) {
  console.log(`🔄 Toggle nested sub-questions for ${subQuestionId}`);
  console.log(`🔍 BEFORE - showingSubQuestions[${subQuestionId}]:`, showingSubQuestions.value[subQuestionId]);
  console.log(`🔍 BEFORE - subQuestions[${subQuestionId}]:`, subQuestions.value[subQuestionId]);
  
  // Toggle the showing state
  const currentState = showingSubQuestions.value[subQuestionId];
  const newState = !currentState;
  console.log(`🔄 Changing state from ${currentState} to ${newState}`);
  
  // Update the state with spread operator to ensure reactivity
  showingSubQuestions.value = { 
    ...showingSubQuestions.value, 
    [subQuestionId]: newState 
  };
  
  console.log(`🔍 AFTER SET - showingSubQuestions:`, showingSubQuestions.value);
  
  // If we're showing the nested sub-questions and we don't have them loaded yet, fetch them
  if (newState) {
    // Set loading state
    loadingSubQuestions.value = {
      ...loadingSubQuestions.value,
      [subQuestionId]: true
    };
    
    try {
      // Only fetch if we don't already have the data
      if (!subQuestions.value[subQuestionId] || subQuestions.value[subQuestionId].length === 0) {
        console.log(`📥 Fetching nested sub-questions for ${subQuestionId}...`);
        const res = await fetch(`/api/questionnaire/questions/listQuestions?questionnaireID=${questionnaireId}&parentID=${subQuestionId}`);
        const result = await res.json();
        
        if (res.ok && result.data) {
          // Process nested sub-questions
          const processedNestedSubQuestions = result.data.map(q => ({
            id: q.question_id,
            question_text_bi: q.question_text_bi,
            question_text_bm: q.question_text_bm,
            is_required: q.is_required,
            status: q.status,
            questionnaire_id: q.questionnaire_id,
            answer_type: q.answer_type,
            has_sub_questions: q.has_sub_questions,
            sub_questions_count: q.sub_questions_count,
            parentID: q.parentID
          }));
          
          // Update the subQuestions state
          subQuestions.value = {
            ...subQuestions.value,
            [subQuestionId]: processedNestedSubQuestions
          };
          
          console.log(`✅ Loaded ${processedNestedSubQuestions.length} nested sub-questions for ${subQuestionId}`);
        } else {
          console.error('Failed to load nested sub-questions:', result.message);
          subQuestions.value = { 
            ...subQuestions.value, 
            [subQuestionId]: [] 
          };
        }
      } else {
        console.log(`📋 Using cached nested sub-questions for ${subQuestionId}`);
      }
    } catch (err) {
      console.error(`Error loading nested sub-questions for ${subQuestionId}:`, err);
      subQuestions.value = { 
        ...subQuestions.value, 
        [subQuestionId]: [] 
      };
    } finally {
      // Clear loading state
      loadingSubQuestions.value = {
        ...loadingSubQuestions.value,
        [subQuestionId]: false
      };
      
      // Force reactivity update
      showingSubQuestions.value = { ...showingSubQuestions.value };
      subQuestions.value = { ...subQuestions.value };
      
      // Debug the state
      //debugState(subQuestionId);
    }
  }
}






// Function to directly force show specific nested sub-questions (hardcoded version)
function forceShowHardcodedNestedSubQuestions() {
  console.log('🔥 FORCE SHOWING HARDCODED NESTED SUB-QUESTIONS');
  
  // Hard-code the IDs we know exist
  const question25Id = 25;  // Question 5
  const question315Id = 315; // Question 5.1
  const question316Id = 316; // Question 5.1.1
  
  // Make sure all required data structures are initialized
  if (!showingSubQuestions.value) showingSubQuestions.value = {};
  if (!loadingSubQuestions.value) loadingSubQuestions.value = {};
  if (!subQuestions.value) subQuestions.value = {};
  
  // Force expand question 5
  showingSubQuestions.value[question25Id] = true;
  
  // Force expand question 5.1
  showingSubQuestions.value[question315Id] = true;
  
  // Force load question 5's sub-questions if not already loaded
  if (!subQuestions.value[question25Id]) {
    console.log('🔄 Force loading sub-questions for question 25');
    fetchSubQuestions(question25Id, true).then(() => {
      // Find question 315 in the sub-questions and update its properties
      const question315 = subQuestions.value[question25Id]?.find(q => q.id === question315Id);
      if (question315) {
        console.log('✅ Found question 315 in sub-questions of 25');
        question315.has_sub_questions = true;
        question315.sub_questions_count = 1;
        
        // Force load question 315's sub-questions
        fetchSubQuestions(question315Id, true).then(() => {
          console.log('✅ Loaded sub-questions for question 315');
          console.log('📊 subQuestions[315]:', subQuestions.value[question315Id]);
          
          // Force render by triggering reactivity
          showingSubQuestions.value = { ...showingSubQuestions.value };
          subQuestions.value = { ...subQuestions.value };
          
          // Add direct reference to question 316 in the DOM for debugging
          setTimeout(() => {
            console.log('🔍 Checking DOM for question 316 elements:');
            console.log('📊 Elements with data-question-id="316":', document.querySelectorAll('[data-question-id="316"]').length);
          }, 500);
        });
      } else {
        console.log('❌ Could not find question 315 in sub-questions of 25');
      }
    });
  } else {
    // Question 5's sub-questions are already loaded
    console.log('✅ Question 25 sub-questions already loaded');
    
    // Find question 315 in the sub-questions and update its properties
    const question315 = subQuestions.value[question25Id]?.find(q => q.id === question315Id);
    if (question315) {
      console.log('✅ Found question 315 in sub-questions of 25');
      question315.has_sub_questions = true;
      question315.sub_questions_count = 1;
      
      // Force load question 315's sub-questions
      fetchSubQuestions(question315Id, true).then(() => {
        console.log('✅ Loaded sub-questions for question 315');
        console.log('📊 subQuestions[315]:', subQuestions.value[question315Id]);
        
        // Force render by triggering reactivity
        showingSubQuestions.value = { ...showingSubQuestions.value };
        subQuestions.value = { ...subQuestions.value };
      });
    } else {
      console.log('❌ Could not find question 315 in sub-questions of 25');
    }
  }
}

// Function to load all nested sub-questions
async function loadAllNestedSubQuestions() {
  console.log('🔄 Loading all nested sub-questions');
  
  try {
    // Directly load sub-questions for question 315 (which has question 316 as a nested sub-question)
    if (!subQuestions.value['315']) {
      console.log('📋 Loading sub-questions for question 315');
      const res = await fetch(`/api/questionnaire/questions/listQuestions?questionnaireID=${questionnaireId}&parentID=315`);
      const result = await res.json();
      
      if (res.ok && result.data) {
        subQuestions.value['315'] = result.data.map(q => ({
          id: q.question_id,
          question_text_bi: q.question_text_bi,
          question_text_bm: q.question_text_bm,
          is_required: q.is_required,
          status: q.status,
          questionnaire_id: q.questionnaire_id,
          answer_type: q.answer_type,
          has_sub_questions: q.has_sub_questions,
          sub_questions_count: q.sub_questions_count,
          parentID: q.parentID
        }));
        showingSubQuestions.value['315'] = true;
        console.log('✅ Loaded sub-questions for question 315:', subQuestions.value['315']);
      }
    }
    
    // Directly load sub-questions for question 311 (which has question 313 as a nested sub-question)
    if (!subQuestions.value['311']) {
      console.log('📋 Loading sub-questions for question 311');
      const res = await fetch(`/api/questionnaire/questions/listQuestions?questionnaireID=${questionnaireId}&parentID=311`);
      const result = await res.json();
      
      if (res.ok && result.data) {
        subQuestions.value['311'] = result.data.map(q => ({
          id: q.question_id,
          question_text_bi: q.question_text_bi,
          question_text_bm: q.question_text_bm,
          is_required: q.is_required,
          status: q.status,
          questionnaire_id: q.questionnaire_id,
          answer_type: q.answer_type,
          has_sub_questions: q.has_sub_questions,
          sub_questions_count: q.sub_questions_count,
          parentID: q.parentID
        }));
        showingSubQuestions.value['311'] = true;
        console.log('✅ Loaded sub-questions for question 311:', subQuestions.value['311']);
      }
    }
    
    // Force reactivity update
    showingSubQuestions.value = { ...showingSubQuestions.value };
    subQuestions.value = { ...subQuestions.value };
    
    console.log('✅ Successfully loaded all nested sub-questions');
  } catch (err) {
    console.error('❌ Error loading nested sub-questions:', err);
  }
}

// Function to force refresh all sub-questions
async function forceRefreshSubQuestions() {
  console.log('🔄 Force refreshing all sub-questions');
  isLoading.value = true;
  
  try {
    // First, get all questions that have sub-questions
    const questionsWithSubs = questions.value.filter(q => q.has_sub_questions);
    console.log(`📋 Found ${questionsWithSubs.length} main questions with sub-questions`);
    
    // Fetch sub-questions for each main question
    for (const question of questionsWithSubs) {
      console.log(`📋 Refreshing sub-questions for main question ${question.id}`);
      showingSubQuestions.value[question.id] = true;
      await fetchSubQuestions(question.id, true);
      
      // Check for nested sub-questions
      if (subQuestions.value[question.id]) {
        const subQuestionsWithSubs = subQuestions.value[question.id].filter(sq => sq.has_sub_questions);
        console.log(`📋 Found ${subQuestionsWithSubs.length} sub-questions with nested sub-questions`);
        
        // Fetch nested sub-questions
        for (const subQuestion of subQuestionsWithSubs) {
          console.log(`📋 Refreshing nested sub-questions for sub-question ${subQuestion.id}`);
          showingSubQuestions.value[subQuestion.id] = true;
          await fetchSubQuestions(subQuestion.id, true);
        }
      }
    }
    
    // Also load specific nested sub-questions
    await loadAllNestedSubQuestions();
    
    // Force reactivity update
    showingSubQuestions.value = { ...showingSubQuestions.value };
    subQuestions.value = { ...subQuestions.value };
    
    console.log('✅ Successfully refreshed all sub-questions');
    showMessage('Sub-questions refreshed successfully', 'success');
  } catch (err) {
    console.error('❌ Error refreshing sub-questions:', err);
    showMessage('Error refreshing sub-questions', 'error');
  } finally {
    isLoading.value = false;
  }
}

// Function to expand the full question hierarchy to show nested sub-questions
async function expandFullHierarchy(parentId, childId) {
  console.log(`🔍 Expanding full hierarchy from parent ${parentId} to child ${childId}`);
  
  // First expand the parent
  showingSubQuestions.value[parentId] = true;
  await fetchSubQuestions(parentId, true);
  
  // Find the child question in the parent's sub-questions and update its has_sub_questions property
  if (subQuestions.value[parentId]) {
    const childQuestion = subQuestions.value[parentId].find(q => q.id === childId);
    if (childQuestion) {
      console.log(`📋 Found child question ${childId} in parent ${parentId}'s sub-questions`);
      childQuestion.has_sub_questions = true;
      childQuestion.sub_questions_count = 1; // Set to at least 1
    }
  }
  
  // Then expand the child
  showingSubQuestions.value[childId] = true;
  await fetchSubQuestions(childId, true);
  
  console.log(`✅ Full hierarchy expanded: ${parentId} → ${childId}`);
}

function openHeaderModal() {
  headerContent.value = questionnaire.value.header || '';
  showHeaderModal.value = true;
}

async function saveHeader() {
  try {
    const res = await fetch('/api/questionnaire/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionnaireID: questionnaire.value.id,
        title: questionnaire.value.name,
        description: questionnaire.value.description,
        header: headerContent.value,
        status: questionnaire.value.status
      })
    });

    const result = await res.json();

    if (res.ok) {
      questionnaire.value.header = headerContent.value;
      showHeaderModal.value = false;
      showMessage('Header updated successfully', 'success');
    } else {
      showMessage(`Failed to update header: ${result.message}`, 'error');
    }
  } catch (err) {
    console.error('Error updating header:', err);
    showMessage('Error updating header', 'error');
  }
}

function openAddQuestionModal(parentQuestion = null) {
  // Don't allow adding questions for protected questionnaires
  if (isProtectedQuestionnaire.value) {
    showMessage('Questions cannot be added for this questionnaire as it is a system questionnaire.', 'error');
    return;
  }
  
  newQuestion.value = {
    question_bm: '',
    question_en: '',
    requiredQuestion: '',
    status: '',
    answer_type: '',
  };
  isEditingQuestion.value = false;
  editQuestionId.value = null;
  addingSubQuestionFor.value = parentQuestion ? parentQuestion.id : null;
  showQuestionModal.value = true;
}

async function openEditQuestionModal(question) {
  // Don't allow editing questions for protected questionnaires
  if (isProtectedQuestionnaire.value) {
    showMessage('Questions cannot be edited for this questionnaire as it is a system questionnaire.', 'error');
    return;
  }
  
  // Initialize with question data
  newQuestion.value = {
    question_bm: question.question_text_bm,
    question_en: question.question_text_bi,
    requiredQuestion: question.is_required,
    status: question.status,
    answer_type: question.answer_type
  };
  
  isEditingQuestion.value = true;
  editQuestionId.value = question.id;
  
  // If this is a sub-question (has parentID), set the addingSubQuestionFor value
  if (question.parentID) {
    addingSubQuestionFor.value = question.parentID;
  } else {
    addingSubQuestionFor.value = null;
  }
  
  showQuestionModal.value = true;
}

async function saveQuestion() {
  const payload = {
    question_bm: newQuestion.value.question_bm,
    question_en: newQuestion.value.question_en,
    requiredQuestion: newQuestion.value.requiredQuestion,
    status: newQuestion.value.status,
    answer_type: newQuestion.value.answer_type
  };

  // Add parentID if adding a sub-question
  if (addingSubQuestionFor.value) {
    payload.parentID = addingSubQuestionFor.value;
  }

  try {
    let res;
    let endpoint;
    let method;

    if (isEditingQuestion.value) {
      // If editing, use the update endpoint
      endpoint = '/api/questionnaire/questions/updateQuestions';
      method = 'PUT';
      payload.questionID = editQuestionId.value; // Add question ID for update
    } else {
      // If creating new, use the insert endpoint
      endpoint = '/api/questionnaire/questions/insertQuestions';
      method = 'POST';
      payload.questionnaire_id = parseInt(questionnaireId); // Add questionnaire ID for new questions
    }

    res = await fetch(endpoint, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (res.ok && result.data) {
      showQuestionModal.value = false;
      modalErrorMessage.value = '';
      showMessage(`Question ${isEditingQuestion.value ? 'updated' : 'created'} successfully`, 'success');
      
      // If we added a sub-question, refresh the parent's sub-questions
      if (addingSubQuestionFor.value) {
        await fetchSubQuestions(addingSubQuestionFor.value);
        // Also refresh the main questions to update the sub-question count
        await fetchQuestions();
      } else {
        await fetchQuestions(); // Only fetch questions, not the whole questionnaire data
      }
      
      // Reset the addingSubQuestionFor value
      addingSubQuestionFor.value = null;
    } else {
      console.error(`Failed to ${isEditingQuestion.value ? 'update' : 'create'} question:`, result.message);
      modalErrorMessage.value = result.message || `Failed to ${isEditingQuestion.value ? 'update' : 'create'} question`;
    }
  } catch (err) {
    console.error(`Error ${isEditingQuestion.value ? 'updating' : 'creating'} question:`, err);
    modalErrorMessage.value = 'An unexpected error occurred';
  }
}

// Status toggle functions
function confirmToggleStatus(question) {
  pendingToggleQuestion.value = question;
  showConfirmToggleModal.value = true;
}

function cancelToggleStatus() {
  pendingToggleQuestion.value = null;
  showConfirmToggleModal.value = false;
}

async function performToggleStatus() {
  const question = pendingToggleQuestion.value;
  const newStatus = question.status === 'Active' ? 'Inactive' : 'Active';
  isTogglingStatus.value = true;

  try {
    const res = await fetch('/api/questionnaire/questions/updateStatus', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        questionID: question.id, 
        status: newStatus 
      }),
    });

    const result = await res.json();
    if (res.ok) {
      question.status = newStatus;
      showMessage(`Question status updated to ${newStatus}`, 'success');
    } else {
      showMessage(`Error updating status: ${result.message}`, 'error');
    }
  } catch (err) {
    console.error('Status update error:', err);
    showMessage('An error occurred while updating status.', 'error');
  } finally {
    showConfirmToggleModal.value = false;
    pendingToggleQuestion.value = null;
    isTogglingStatus.value = false;
  }
}

function goBack() {
  router.push('/questionnaire');
}

async function searchQuestions() {
  if (!searchQuery.value.trim()) {
    showMessage('Please enter a search query', 'error');
    return;
  }

  isSearching.value = true;
  try {
    const res = await fetch(`/api/questionnaire/questions/search?query=${encodeURIComponent(searchQuery.value)}`);
    const result = await res.json();

    if (res.ok && result.data) {
      // Filter out questions that are already in the current questionnaire
      searchResults.value = result.data.filter(
        question => question.questionnaire_id !== parseInt(questionnaireId)
      );
      
      if (searchResults.value.length === 0) {
        showMessage('No new questions found that can be added to this questionnaire', 'error');
      }
    } else {
      searchResults.value = [];
      showMessage(result.message || 'No questions found', 'error');
    }
  } catch (err) {
    console.error('Search error:', err);
    showMessage('Error searching questions', 'error');
    searchResults.value = [];
  } finally {
    isSearching.value = false;
  }
}

function toggleSearchForm() {
  showSearchForm.value = !showSearchForm.value;
  if (!showSearchForm.value) {
    searchResults.value = [];
    searchQuery.value = '';
  }
}

async function addExistingQuestion(question) {
  try {
    const payload = {
      questionnaire_id: parseInt(questionnaireId),
      question_bm: question.question_bm,
      question_en: question.question_en,
      requiredQuestion: question.requiredQuestion,
      status: question.status
    };

    const res = await fetch('/api/questionnaire/questions/insertQuestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (res.ok && result.data) {
      showMessage('Question added successfully', 'success');
      await fetchQuestionnaireData();
      searchResults.value = searchResults.value.filter(q => q.id !== question.id);
    } else {
      showMessage(result.message || 'Failed to add question', 'error');
    }
  } catch (err) {
    console.error('Error adding existing question:', err);
    showMessage('Error adding question', 'error');
  }
}

function getAnswerTypeLabel(answerType) {
  if (!answerType) return 'N/A';
  
  const found = answerTypeOptions.value.find(type => parseInt(type.value) === parseInt(answerType));
  return found ? found.label : `Type ID: ${answerType}`;
}

// Delete functions
function confirmDelete(question) {
  // Don't allow deleting questions for protected questionnaires
  if (isProtectedQuestionnaire.value) {
    showMessage('Questions cannot be deleted for this questionnaire as it is a system questionnaire.', 'error');
    return;
  }
  
  pendingDeleteQuestion.value = question;
  showDeleteModal.value = true;
}

function cancelDelete() {
  pendingDeleteQuestion.value = null;
  showDeleteModal.value = false;
}

async function performDelete() {
  const question = pendingDeleteQuestion.value;
  isDeleting.value = true;

  try {
    const res = await fetch(`/api/questionnaire/questions/deleteQuestions?questionID=${question.id}`, {
      method: 'DELETE'
    });

    const result = await res.json();
    if (res.ok) {
      // If this is a sub-question, refresh the parent's sub-questions
      if (question.parentID) {
        await fetchSubQuestions(question.parentID);
        // Also refresh the main questions to update the sub-question count
        await fetchQuestions();
      } else {
        // If it's a main question, just refresh the main list
        await fetchQuestions();
      }
      showMessage('Question deleted successfully', 'success');
    } else {
      showMessage(`Error deleting question: ${result.message}`, 'error');
    }
  } catch (err) {
    console.error('Delete error:', err);
    showMessage('An error occurred while deleting the question.', 'error');
  } finally {
    showDeleteModal.value = false;
    pendingDeleteQuestion.value = null;
    isDeleting.value = false;
  }
}
</script>

<style>
.formkit-label::after {
  content: '*';
  color: red;
  margin-left: 4px;
}

.toggle-checkbox {
  width: 42px;
  height: 22px;
  appearance: none;
  background-color: #ddd;
  border-radius: 12px;
  position: relative;
  outline: none;
  cursor: pointer;
  transition: background-color 0.3s ease;
}
.toggle-checkbox:checked {
  background-color: #10b981;
}
.toggle-checkbox::before {
  content: "";
  width: 18px;
  height: 18px;
  background: white;
  position: absolute;
  top: 2px;
  left: 2px;
  border-radius: 50%;
  transition: transform 0.3s ease;
}
.toggle-checkbox:checked::before {
  transform: translateX(20px);
}

/* Rotation for chevron icon */
.rotate-90 {
  transform: rotate(90deg);
  transition: transform 0.2s ease;
}

/* Table styles for fixed width and text truncation */
.questions-table {
  table-layout: fixed;
  width: 100%;
}

.questions-table th,
.questions-table td {
  overflow: hidden;
  text-overflow: ellipsis;
}

.questions-table .question-text {
  max-width: 100%;
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: break-word;
  line-height: 1.4;
}

.questions-table .col-question-bm,
.questions-table .col-question-en {
  width: 25%;
}

.questions-table .col-required,
.questions-table .col-answer-type,
.questions-table .col-status {
  width: 12%;
}

.questions-table .col-actions {
  width: 14%;
}

/* Tooltip for truncated text */
.tooltip-container {
  position: relative;
  display: inline-block;
  width: 100%;
}

.tooltip-text {
  visibility: hidden;
  width: 300px;
  background-color: #333;
  color: #fff;
  text-align: left;
  border-radius: 6px;
  padding: 8px;
  position: absolute;
  z-index: 10;
  top: 100%;
  left: 0;
  opacity: 0;
  transition: opacity 0.3s;
  font-size: 12px;
  line-height: 1.4;
  white-space: normal;
  word-wrap: break-word;
  margin-top: 5px;
}

.tooltip-container:hover .tooltip-text {
  visibility: visible;
  opacity: 1;
}
</style>

<template>
  <div>
    <div class="flex items-center mb-4">
      <button @click="goBack" class="mr-2 p-2 rounded hover:bg-gray-100">
        <Icon name="material-symbols:arrow-back" />
      </button>
      <h1 class="text-2xl font-bold">Questions Management</h1>
    </div>

    <div v-if="message" class="mb-4 p-3 rounded text-white"
      :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
      {{ message }}
    </div>

    <div v-if="isLoading" class="flex justify-center my-8">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>

    <div v-else-if="questionnaire">
      <div class="card mb-6 p-4">
        <h2 class="text-xl font-semibold">{{ questionnaire.name }}</h2>
        <p class="text-sm text-gray-500">{{ questionnaire.description }} | 
          <span :class="questionnaire.status === 'Active' ? 'text-green-600' : 'text-red-500'">
            {{ questionnaire.status }}
          </span>
        </p>
        
        <div class="mt-4 border-t pt-3">
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-md font-medium">Questionnaire Header/Instructions</h3>
            <rs-button v-if="!isProtectedQuestionnaire" @click="openHeaderModal" size="sm" >
              <Icon name="material-symbols:edit-outline-rounded" class="mr-1" />
              Edit Header
            </rs-button>
          </div>
          <div v-if="questionnaire.header" class="bg-gray-50 p-3 rounded border">
            <div v-html="questionnaire.header" class="text-red-600"></div>
          </div>
          <div v-else class="bg-gray-50 p-3 rounded border text-gray-500 italic">
            No header/instructions added yet. Click "Edit Header" to add instructions for this questionnaire.
          </div>
        </div>
      </div>

      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold">Questions ({{ questions.length }})</h3>
        <div class="flex gap-2">
          <rs-button v-if="!isProtectedQuestionnaire" @click="openAddQuestionModal">
            <Icon name="material-symbols:add" class="mr-1" />
            Add New Question
          </rs-button>
        </div>
      </div>

      <div class="card p-4 overflow-x-auto">
        <div v-if="questions.length === 0" class="text-center py-8">
          <div class="flex flex-col items-center">
            <Icon name="material-symbols:format-list-bulleted-add" size="64" class="text-gray-400 mb-4" />
            <h3 class="text-xl font-medium text-gray-600 mb-2">No Questions Added Yet</h3>
            <p class="text-gray-500 mb-6">This questionnaire doesn't have any questions yet.</p>
            <div class="flex gap-4">
              <rs-button v-if="!isProtectedQuestionnaire" @click="openAddQuestionModal">
                <Icon name="material-symbols:add" class="mr-1" />
                Add New Question
              </rs-button>
            </div>
          </div>
        </div>
        
        
        <div class="overflow-hidden">
          <table class="questions-table divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider col-no" style="min-width: 40px; width: 40px;">
                  No
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider col-question-bm">
                  Question
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider col-question-en">
                  Description
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider col-required">
                  Required
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider col-answer-type">
                  Answer Type
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider col-status">
                  Status
                </th>
                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider col-actions">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <!-- Main questions -->
              <template v-for="(question, index) in questions" :key="question.id">
                <tr>
                  <td class="px-2 py-4 text-center">
                    <div class="text-sm font-medium text-gray-900">{{ index + 1 }}</div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex items-center">
                      <!-- Sub-question toggle button if question has sub-questions -->
                      <button 
                        v-if="question.has_sub_questions" 
                        @click="toggleSubQuestions(question.id)"
                        class="mr-2 text-gray-500 hover:text-gray-700 flex items-center"
                        :class="{'rotate-90': showingSubQuestions[question.id]}"
                      >
                        <Icon name="material-symbols:chevron-right" size="20" />
                        <span class="text-xs ml-1 bg-gray-200 px-1.5 py-0.5 rounded-full">{{ question.sub_questions_count }}</span>
                      </button>
                      <!-- Spacer if no sub-questions -->
                      <div v-else class="w-5"></div>
                      
                      <div class="text-sm text-gray-900 question-text">{{ question.question_text_bi }}</div>
                    </div>
                  </td>
                                      <td class="px-6 py-4">
                      <div class="text-sm text-gray-900 question-text">{{ question.question_text_bm }}</div>
                    </td>
                  <td class="px-6 py-4">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" 
                          :class="question.is_required ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'">
                      {{ question.is_required ? 'Yes' : 'No' }}
                    </span>
                  </td>
                  <td class="px-6 py-4">
                    <div class="text-sm text-gray-900">
                      {{ getAnswerTypeLabel(question.answer_type) }}
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex items-center">
                      <input
                        type="checkbox"
                        class="toggle-checkbox"
                        :checked="question.status === 'Active'"
                        @click.prevent="confirmToggleStatus(question)"
                        title="Toggle Status"
                      />
                      <span class="ml-2 text-xs text-gray-500">{{ question.status }}</span>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-right text-sm font-medium">
                    <div class="flex justify-end gap-3 items-center">
                      <button 
                        v-if="!isProtectedQuestionnaire"
                        @click="openEditQuestionModal(question)" 
                        class="text-indigo-600 hover:text-indigo-900"
                        title="Edit Question"
                      >
                        <Icon name="material-symbols:edit-outline-rounded" size="20" />
                      </button>
                      
                      <button 
                        @click="router.push(`/questionnaire/questions/options/${question.id}`)"
                        class="text-blue-600 hover:text-blue-900"
                        title="Manage Options"
                      >
                        <Icon name="material-symbols:list-alt-outline" size="20" />
                      </button>

                      <button 
                        v-if="!isProtectedQuestionnaire"
                        @click="openAddQuestionModal(question)"
                        class="text-green-600 hover:text-green-900"
                        title="Add Sub-question"
                      >
                        <Icon name="material-symbols:add" size="20" />
                        <span class="sr-only">Add Sub-question</span>
                      </button>
                      
                      <button 
                        v-if="!isProtectedQuestionnaire"
                        @click="confirmDelete(question)"
                        class="text-red-600 hover:text-red-900"
                        title="Delete Question"
                      >
                        <Icon name="material-symbols:delete-outline" size="20" />
                      </button>
                    </div>
                  </td>
                </tr>
                
                <!-- Loading indicator for sub-questions -->
                <tr v-if="loadingSubQuestions[question.id] && showingSubQuestions[question.id]">
                  <td colspan="7" class="px-6 py-4 bg-gray-200">
                    <div class="flex justify-center">
                      <div class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary"></div>
                    </div>
                  </td>
                </tr>
                
                <!-- Sub-questions -->
                <template v-if="question && question.id && showingSubQuestions && showingSubQuestions[question.id]">
                  
                  <!-- Loading indicator -->
                  <tr v-if="loadingSubQuestions[question.id]">
                    <td colspan="7" class="px-6 py-4 bg-gray-100">
                      <div class="flex justify-center">
                        <div class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary"></div>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- No sub-questions message -->
                  <tr v-else-if="!subQuestions[question.id] || subQuestions[question.id].length === 0">
                    <td colspan="7" class="px-6 py-4 bg-gray-100 text-center text-gray-500">
                      No sub-questions found
                    </td>
                  </tr>
                  
                  <!-- Dynamic solution for all questions -->
                  <tr v-else v-for="(subQuestion, subIndex) in subQuestions[question.id]" 
                      :key="subQuestion.id" 
                      class="bg-gray-200">
                    <td class="px-2 py-4 text-center">
                      <div class="text-sm font-medium text-gray-900">{{ index + 1 }}.{{ subIndex + 1 }}</div>
                    </td>
                    <td class="px-6 py-4">
                      <div class="flex items-center">
                        <!-- Toggle button for nested sub-questions -->
                        <button 
                          v-if="subQuestion.has_sub_questions" 
                          @click="toggleNestedSubQuestions(subQuestion.id)"
                          class="mr-2 text-gray-500 hover:text-gray-700 flex items-center"
                          :class="{'rotate-90': showingSubQuestions[subQuestion.id]}"
                        >
                          <Icon name="material-symbols:chevron-right" size="20" />
                          <span class="text-xs ml-1 bg-gray-300 px-1.5 py-0.5 rounded-full">{{ subQuestion.sub_questions_count }}</span>
                        </button>
                        <!-- Spacer if no sub-questions -->
                        <div v-else class="w-5"></div>
                        <div class="text-sm text-gray-900 question-text">{{ subQuestion.question_text_bi }}</div>
                      </div>
                    </td>
                    <td class="px-6 py-4">
                      <div class="text-sm text-gray-900 question-text">{{ subQuestion.question_text_bm }}</div>
                    </td>
                    <td class="px-6 py-4">
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" 
                            :class="subQuestion.is_required ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'">
                        {{ subQuestion.is_required ? 'Yes' : 'No' }}
                      </span>
                    </td>
                    <td class="px-6 py-4">
                      <div class="text-sm text-gray-900">
                        {{ getAnswerTypeLabel(subQuestion.answer_type) }}
                      </div>
                    </td>
                    <td class="px-6 py-4">
                      <div class="flex items-center">
                        <input
                          type="checkbox"
                          class="toggle-checkbox"
                          :checked="subQuestion.status === 'Active'"
                          @click.prevent="confirmToggleStatus(subQuestion)"
                          title="Toggle Status"
                        />
                        <span class="ml-2 text-xs text-gray-500">{{ subQuestion.status }}</span>
                      </div>
                    </td>
                    <td class="px-6 py-4 text-right text-sm font-medium">
                      <div class="flex justify-end gap-3 items-center">
                        <button 
                          v-if="!isProtectedQuestionnaire"
                          @click="openEditQuestionModal(subQuestion)" 
                          class="text-indigo-600 hover:text-indigo-900"
                          title="Edit Question"
                        >
                          <Icon name="material-symbols:edit-outline-rounded" size="20" />
                        </button>
                        
                        <button 
                          @click="router.push(`/questionnaire/questions/options/${subQuestion.id}`)"
                          class="text-blue-600 hover:text-blue-900"
                          title="Manage Options"
                        >
                          <Icon name="material-symbols:list-alt-outline" size="20" />
                        </button>

                        <button 
                          v-if="!isProtectedQuestionnaire"
                          @click="openAddQuestionModal(subQuestion)"
                          class="text-green-600 hover:text-green-900"
                          title="Add Sub-question"
                        >
                          <Icon name="material-symbols:add" size="20" />
                          <span class="sr-only">Add Sub-question</span>
                        </button>

                        <button 
                          v-if="!isProtectedQuestionnaire"
                          @click="confirmDelete(subQuestion)"
                          class="text-red-600 hover:text-red-900"
                          title="Delete Question"
                        >
                          <Icon name="material-symbols:delete-outline" size="20" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Nested sub-questions section -->
                  <template v-for="(subQuestion, subIndex) in subQuestions[question.id] || []" :key="`subq-container-${subQuestion ? subQuestion.id : subIndex}`">
                    
                    <!-- Loading indicator for nested sub-questions -->
                    <tr v-if="subQuestion && subQuestion.has_sub_questions && loadingSubQuestions[subQuestion.id] && showingSubQuestions[subQuestion.id]">
                      <td colspan="7" class="px-6 py-4 bg-gray-300">
                        <div class="flex justify-center">
                          <div class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary"></div>
                        </div>
                      </td>
                    </tr>
                    
                    <!-- No nested sub-questions message -->
                    <tr v-else-if="subQuestion && subQuestion.has_sub_questions && showingSubQuestions[subQuestion.id] && (!subQuestions[subQuestion.id] || subQuestions[subQuestion.id].length === 0)">
                      <td colspan="7" class="px-6 py-4 bg-gray-300 text-center text-gray-500">
                        No nested sub-questions found
                      </td>
                    </tr>
                    
                    <!-- Dynamic nested sub-questions rendering -->
                    <template v-if="subQuestion && subQuestion.has_sub_questions && showingSubQuestions[subQuestion.id]" :key="`nested-content-${subQuestion.id}`">
                      
                      <!-- Actual nested sub-questions -->
                      <tr v-for="(nestedSubQuestion, nestedIndex) in subQuestions[subQuestion.id] || []" 
                          class="bg-gray-300"
                          :data-question-id="nestedSubQuestion.id"
                          data-nested-level="2">
                      <td class="px-2 py-4 text-center">
                        <div class="text-sm font-medium text-gray-900">{{ index + 1 }}.{{ subIndex + 1 }}.{{ nestedIndex + 1 }}</div>
                      </td>
                      <td class="px-6 py-4">
                        <div class="flex items-center">
                          <div class="w-5 ml-10"></div> <!-- Extra indentation for nested sub-questions -->
                          <div class="text-sm text-gray-900 question-text">{{ nestedSubQuestion.question_text_bi }}</div>
                        </div>
                      </td>
                      <td class="px-6 py-4">
                        <div class="text-sm text-gray-900 question-text">{{ nestedSubQuestion.question_text_bm }}</div>
                      </td>
                      <td class="px-6 py-4">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" 
                              :class="nestedSubQuestion.is_required ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'">
                          {{ nestedSubQuestion.is_required ? 'Yes' : 'No' }}
                        </span>
                      </td>
                      <td class="px-6 py-4">
                        <div class="text-sm text-gray-900">
                          {{ getAnswerTypeLabel(nestedSubQuestion.answer_type) }}
                        </div>
                      </td>
                      <td class="px-6 py-4">
                        <div class="flex items-center">
                          <input
                            type="checkbox"
                            class="toggle-checkbox"
                            :checked="nestedSubQuestion.status === 'Active'"
                            @click.prevent="confirmToggleStatus(nestedSubQuestion)"
                            title="Toggle Status"
                          />
                          <span class="ml-2 text-xs text-gray-500">{{ nestedSubQuestion.status }}</span>
                        </div>
                      </td>
                      <td class="px-6 py-4 text-right text-sm font-medium">
                        <div class="flex justify-end gap-3 items-center">
                          <button 
                            v-if="!isProtectedQuestionnaire"
                            @click="openEditQuestionModal(nestedSubQuestion)" 
                            class="text-indigo-600 hover:text-indigo-900"
                            title="Edit Question"
                          >
                            <Icon name="material-symbols:edit-outline-rounded" size="20" />
                          </button>
                          
                          <button 
                            @click="router.push(`/questionnaire/questions/options/${nestedSubQuestion.id}`)"
                            class="text-blue-600 hover:text-blue-900"
                            title="Manage Options"
                          >
                            <Icon name="material-symbols:list-alt-outline" size="20" />
                          </button>

                          <button 
                            v-if="!isProtectedQuestionnaire"
                            @click="confirmDelete(nestedSubQuestion)"
                            class="text-red-600 hover:text-red-900"
                            title="Delete Question"
                          >
                            <Icon name="material-symbols:delete-outline" size="20" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    </template>
                  </template>
                </template>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <rs-modal
      :title="isEditingQuestion ? 'Edit Question' : (addingSubQuestionFor ? 'Add Sub-Question' : 'Add Question')"
      v-model="showQuestionModal"
      :overlay-close="false"
      :hide-footer="true"
    >
      <div v-if="modalErrorMessage" class="mb-3 p-2 rounded bg-red-100 text-red-700 border border-red-300">
        {{ modalErrorMessage }}
      </div>
      
      <!-- Show parent question info when adding/editing a sub-question -->
      <div v-if="addingSubQuestionFor" class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
        <div class="text-sm font-medium text-blue-800">
          <template v-if="isEditingQuestion">Editing sub-question</template>
          <template v-else>Adding sub-question</template>
        </div>
        <div class="text-xs text-blue-600 mt-1">Parent Question ID: {{ addingSubQuestionFor }}</div>
      </div>

      <FormKit type="form" @submit="saveQuestion" :actions="false">
        <FormKit
          type="text"
          v-model="newQuestion.question_en"
          name="questionTextEn"
          label="Question"
          placeholder="Enter question"
        />
        <FormKit
          type="text"
          v-model="newQuestion.question_bm"
          name="questionTextBm"
          label="Description"
          placeholder="Enter description"
        />

        <FormKit
          type="select"
          v-model="newQuestion.requiredQuestion"
          label="Required Question"
          :options="[
            { label: '-- Please select --', value: '' },
            { label: 'Yes', value: '1' },
            { label: 'No', value: '0' }
          ]"
          validation="required"
          validation-visibility="dirty"
          :validation-messages="{ required: 'This field is required' }"
        />

        <FormKit
          type="select"
          v-model="newQuestion.answer_type"
          label="Answer Type"
          :options="[{ label: '-- Please select --', value: '' }, ...answerTypeOptions]"
          validation="required"
          validation-visibility="dirty"
          :validation-messages="{ required: 'This field is required' }"
        />

        <FormKit
          type="select"
          v-model="newQuestion.status"
          label="Question Status"
          :options="[
            { label: '-- Please select --', value: '' },
            { label: 'Active', value: 'Active' },
            { label: 'Inactive', value: 'Inactive' }
          ]"
          validation="required"
          validation-visibility="dirty"
          :validation-messages="{ required: 'This field is required' }"
        />

        <div class="flex justify-end gap-2 mt-4">
          <button
            type="button"
            class="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 text-black"
            @click="showQuestionModal = false"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
          >
            Save
          </button>
        </div>
      </FormKit>
    </rs-modal>

    <rs-modal
      title="Edit Autism Screening Header"
      v-model="showHeaderModal"
      :overlay-close="false"
      :hide-footer="true"
    >
      <FormKit type="form" @submit="saveHeader" :actions="false">
        <FormKit
          type="textarea"
          v-model="headerContent"
          name="headerContent"
          label="Header/Instructions"
          placeholder="Enter instructions or header text for the autism screening"
          rows="6"
        />

        <div class="text-sm text-gray-500 mb-4">
          You can use basic HTML formatting for the header content.
        </div>

        <div class="flex justify-end gap-2 mt-4">
          <button
            type="button"
            class="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 text-black"
            @click="showHeaderModal = false"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
          >
            Save
          </button>
        </div>
      </FormKit>
    </rs-modal>

    <rs-modal
      title="Toggle Status"
      ok-title="Yes"
      cancel-title="No"
      :ok-callback="performToggleStatus"
      :cancel-callback="cancelToggleStatus"
      v-model="showConfirmToggleModal"
      :overlay-close="false"
    >
      <p>
        Are you sure you want to change this question's status from 
        <span class="font-semibold" :class="pendingToggleQuestion?.status === 'Active' ? 'text-green-600' : 'text-red-600'">
          {{ pendingToggleQuestion?.status }}
        </span> 
        to 
        <span class="font-semibold" :class="pendingToggleQuestion?.status === 'Active' ? 'text-red-600' : 'text-green-600'">
          {{ pendingToggleQuestion?.status === 'Active' ? 'Inactive' : 'Active' }}
        </span>?
      </p>

      <div v-if="isTogglingStatus" class="flex justify-center items-center mt-4 p-2 bg-blue-50 rounded-md">
        <Icon name="line-md:loading-twotone-loop" class="text-primary mr-2" />
        <span>Updating status...</span>
      </div>
    </rs-modal>

    <rs-modal
      title="Delete Question"
      ok-title="Delete"
      cancel-title="Cancel"
      :ok-callback="performDelete"
      :cancel-callback="cancelDelete"
      v-model="showDeleteModal"
      :overlay-close="false"
    >
      <p class="mb-4">
        Are you sure you want to delete this question?
      </p>
      <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <Icon name="material-symbols:warning" class="text-yellow-400" />
          </div>
          <div class="ml-3">
            <p class="text-sm text-yellow-700">
              This action cannot be undone. Deleting this question will also remove all associated options and responses.
              <span v-if="pendingDeleteQuestion?.has_sub_questions" class="font-bold block mt-1">
                Warning: This question has {{ pendingDeleteQuestion?.sub_questions_count }} sub-questions that will also be deleted.
              </span>
            </p>
          </div>
        </div>
      </div>

      <div v-if="isDeleting" class="flex justify-center items-center mt-4 p-2 bg-blue-50 rounded-md">
        <Icon name="line-md:loading-twotone-loop" class="text-primary mr-2" />
        <span>Deleting question...</span>
      </div>
    </rs-modal>
  </div>
</template> 