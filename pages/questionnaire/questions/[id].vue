<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const questionnaireId = route.params.id;

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
      showMessage('Failed to load questionnaire data', 'error');
    }
  } catch (err) {
    console.error('Error loading questionnaire data:', err);
    showMessage('Error loading questionnaire data', 'error');
  } finally {
    isLoading.value = false;
  }
}

async function fetchQuestions() {
  isLoading.value = true;
  try {
    const res = await fetch(`/api/questionnaire/questions/listQuestions?questionnaireID=${questionnaireId}`);
    const result = await res.json();

    if (res.ok && result.data) {
      questions.value = result.data.map(q => ({
        id: q.question_id,
        question_text_bi: q.question_text_bi,
        question_text_bm: q.question_text_bm,
        is_required: q.is_required,
        status: q.status,
        questionnaire_id: q.questionnaire_id,
        answer_type: q.answer_type
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

function openAddQuestionModal() {
  newQuestion.value = {
    question_bm: '',
    question_en: '',
    requiredQuestion: '',
    status: '',
    answer_type: '',
  };
  isEditingQuestion.value = false;
  editQuestionId.value = null;
  showQuestionModal.value = true;
}

function openEditQuestionModal(question) {
  newQuestion.value = {
    question_bm: question.question_text_bm,
    question_en: question.question_text_bi,
    requiredQuestion: question.is_required,
    status: question.status,
    answer_type: question.answer_type
  };
  isEditingQuestion.value = true;
  editQuestionId.value = question.id;
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
      await fetchQuestions(); // Only fetch questions, not the whole questionnaire data
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
  z-index: 1;
  bottom: 125%;
  left: 0;
  opacity: 0;
  transition: opacity 0.3s;
  font-size: 12px;
  line-height: 1.4;
  white-space: normal;
  word-wrap: break-word;
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
            <rs-button @click="openHeaderModal" size="sm">
              <Icon name="material-symbols:edit-outline-rounded" class="mr-1" />
              Edit Header
            </rs-button>
          </div>
          <div v-if="questionnaire.header" class="bg-gray-50 p-3 rounded border">
            <div v-html="questionnaire.header"></div>
          </div>
          <div v-else class="bg-gray-50 p-3 rounded border text-gray-500 italic">
            No header/instructions added yet. Click "Edit Header" to add instructions for this questionnaire.
          </div>
        </div>
      </div>

      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold">Questions ({{ questions.length }})</h3>
        <div class="flex gap-2">
          <rs-button @click="openAddQuestionModal">
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
              <rs-button @click="openAddQuestionModal">
                <Icon name="material-symbols:add" class="mr-1" />
                Add New Question
              </rs-button>
            </div>
          </div>
        </div>
        <div v-else class="overflow-hidden">
          <table class="questions-table divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider col-question-bm">
                  Question (BM)
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider col-question-en">
                  Question (EN)
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
              <tr v-for="question in questions" :key="question.id">
                <td class="px-6 py-4">
                  <div class="tooltip-container">
                    <div class="text-sm text-gray-900 question-text">{{ question.question_text_bm }}</div>
                    <span class="tooltip-text" v-if="question.question_text_bm && question.question_text_bm.length > 50">{{ question.question_text_bm }}</span>
                  </div>
                </td>
                <td class="px-6 py-4">
                  <div class="tooltip-container">
                    <div class="text-sm text-gray-900 question-text">{{ question.question_text_bi }}</div>
                    <span class="tooltip-text" v-if="question.question_text_bi && question.question_text_bi.length > 50">{{ question.question_text_bi }}</span>
                  </div>
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
                      @click="openAddQuestionModal"
                      class="text-blue-600 hover:text-blue-900"
                      title="Manage Options"
                    >
                      <Icon name="material-symbols:add" size="20" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <rs-modal
      :title="isEditingQuestion ? 'Edit Question' : 'Add Question'"
      v-model="showQuestionModal"
      :overlay-close="false"
      :hide-footer="true"
    >
      <div v-if="modalErrorMessage" class="mb-3 p-2 rounded bg-red-100 text-red-700 border border-red-300">
        {{ modalErrorMessage }}
      </div>

      <FormKit type="form" @submit="saveQuestion" :actions="false">
        <FormKit
          type="text"
          v-model="newQuestion.question_bm"
          name="questionTextBm"
          label="Question"
          placeholder="Enter question in Bahasa Malaysia"
          validation="required"
          validation-visibility="dirty"
          :validation-messages="{ required: 'This field is required' }"
        />

        <FormKit
          type="text"
          v-model="newQuestion.question_en"
          name="questionTextEn"
          label="Question in English"
          placeholder="Enter question in English"
          validation="required"
          validation-visibility="dirty"
          :validation-messages="{ required: 'This field is required' }"
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
      title="Edit Questionnaire Header"
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
          placeholder="Enter instructions or header text for the questionnaire"
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
  </div>
</template> 