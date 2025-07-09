<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const modalErrorMessage = ref('');
const questionnaires = ref([]);
const isLoading = ref(true);

const showQuestionnaireModal = ref(false);
const newQuestionnaire = ref({ name: '', description: '', status: '' });
const isEditingQuestionnaire = ref(false);
const editQuestionnaireId = ref(null);

const message = ref('');
const messageType = ref('success'); // 'success' or 'error'

// For status toggle
const showConfirmToggleModal = ref(false);
const pendingToggleQuestionnaire = ref(null);
const isTogglingStatus = ref(false);

// For delete functionality
const showDeleteModal = ref(false);
const pendingDeleteQuestionnaire = ref(null);
const isDeleting = ref(false);

function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;

  // Clear message after 3 seconds
  setTimeout(() => {
    message.value = '';
  }, 3000);
}

onMounted(fetchQuestionnaires)

async function fetchQuestionnaires() {
  isLoading.value = true;
  try {
    const res = await fetch('/api/questionnaire/listQuestionnaires')
    const result = await res.json()

    if (res.ok && result.data) {
      // Map API response to match your frontend structure
      questionnaires.value = result.data.map(q => ({
        id: q.questionnaire_id,
        name: q.title,
        description: q.description,
        status: q.status,
        questions: q.questionnaires_questions.map(qn => ({
          id: qn.question_id,
          question_bm: qn.question_text_bm,
          question_en: qn.question_text_bi,
          requiredQuestion: qn.is_required,
          status: qn.status,
          question: `${qn.question_text_bm} / ${qn.question_text_bi}`,
          action: 'edit',
        }))
      }))

    } else {
      console.error('Failed to load questionnaires:', result.message)
    }
  } catch (err) {
    console.error('Error loading questionnaires:', err)
  } finally {
    isLoading.value = false;
  }
}


function openAddQuestionnaireModal() {
  newQuestionnaire.value = { name: '', description: '', status: '' };
  isEditingQuestionnaire.value = false;
  editQuestionnaireId.value = null;
  showQuestionnaireModal.value = true;
}

function openEditQuestionnaireModal(q) {
  newQuestionnaire.value = {
    name: q.name,
    description: q.description,
    status: q.status,
  };
  isEditingQuestionnaire.value = true;
  editQuestionnaireId.value = q.id;
  showQuestionnaireModal.value = true;
}

async function saveQuestionnaire() {
  if (!newQuestionnaire.value.name.trim()) return;

  const payload = {
    title: newQuestionnaire.value.name,
    description: newQuestionnaire.value.description,
    status: newQuestionnaire.value.status,
  };

  try {
    let res;
    let result;

    if (isEditingQuestionnaire.value) {
      // Update existing questionnaire
      res = await fetch('/api/questionnaire/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          questionnaireID: editQuestionnaireId.value
        }),
      });
      
      result = await res.json();
      
      if (res.ok && result.data) {
        // Update the questionnaire in the local array
        const index = questionnaires.value.findIndex(q => q.id === editQuestionnaireId.value);
        if (index !== -1) {
          questionnaires.value[index] = {
            ...questionnaires.value[index],
            name: result.data.title,
            description: result.data.description,
            status: result.data.status
          };
        }
        
        showQuestionnaireModal.value = false;
        modalErrorMessage.value = '';
        showMessage('Questionnaire updated successfully.', 'success');
      } else {
        console.error('Failed to update questionnaire:', result.message);
        modalErrorMessage.value = result.message || 'Failed to update questionnaire.';
      }
    } else {
      // Create new questionnaire
      res = await fetch('/api/questionnaire/insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      result = await res.json();
      
      if (res.ok && result.data) {
        questionnaires.value.push({
          id: result.data.questionnaire_id,
          name: result.data.title,
          description: result.data.description,
          status: result.data.status,
          questions: [],
        });
        
        showQuestionnaireModal.value = false;
        modalErrorMessage.value = '';
        showMessage('Questionnaire inserted successfully.', 'success');
      } else {
        console.error('Failed to insert questionnaire:', result.message);
        modalErrorMessage.value = result.message || 'Failed to insert questionnaire.';
      }
    }
  } catch (err) {
    console.error('Error while saving questionnaire:', err);
    modalErrorMessage.value = 'An unexpected error occurred.';
  }
}

// Status toggle functions
function confirmToggleStatus(questionnaire) {
  pendingToggleQuestionnaire.value = questionnaire;
  showConfirmToggleModal.value = true;
}

function cancelToggleStatus() {
  pendingToggleQuestionnaire.value = null;
  showConfirmToggleModal.value = false;
}

async function performToggleStatus() {
  const questionnaire = pendingToggleQuestionnaire.value;
  const newStatus = questionnaire.status === 'Active' ? 'Inactive' : 'Active';
  isTogglingStatus.value = true;

  try {
    const res = await fetch('/api/questionnaire/updateStatus', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        questionnaireID: questionnaire.id, 
        status: newStatus 
      }),
    });

    const result = await res.json();
    if (res.ok) {
      questionnaire.status = newStatus;
      showMessage(`Questionnaire status updated to ${newStatus}`, 'success');
    } else {
      showMessage(`Error updating status: ${result.message}`, 'error');
    }
  } catch (err) {
    console.error('Status update error:', err);
    showMessage('An error occurred while updating status.', 'error');
  } finally {
    showConfirmToggleModal.value = false;
    pendingToggleQuestionnaire.value = null;
    isTogglingStatus.value = false;
  }
}

// Delete functions
function confirmDelete(questionnaire) {
  pendingDeleteQuestionnaire.value = questionnaire;
  showDeleteModal.value = true;
}

function cancelDelete() {
  pendingDeleteQuestionnaire.value = null;
  showDeleteModal.value = false;
}

async function performDelete() {
  const questionnaire = pendingDeleteQuestionnaire.value;
  isDeleting.value = true;

  try {
    const res = await fetch(`/api/questionnaire/delete?questionnaireID=${questionnaire.id}`, {
      method: 'DELETE'
    });

    const result = await res.json();
    if (result.statusCode === 200) {
      // Remove the deleted questionnaire from the list
      questionnaires.value = questionnaires.value.filter(q => q.id !== questionnaire.id);
      showMessage('Questionnaire deleted successfully', 'success');
    } else {
      showMessage(`Error deleting questionnaire: ${result.message}`, 'error');
    }
  } catch (err) {
    console.error('Delete error:', err);
    showMessage('An error occurred while deleting the questionnaire.', 'error');
  } finally {
    showDeleteModal.value = false;
    pendingDeleteQuestionnaire.value = null;
    isDeleting.value = false;
  }
}

function navigateToQuestions(questionnaireId) {
  router.push(`/questionnaire/questions/${questionnaireId}`);
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
</style>

<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-2xl font-bold">Questionnaires</h1>
      <div class="flex gap-2">
        <rs-button @click="router.push('/questionnaire/results')">
          <Icon name="material-symbols:analytics-outline" class="mr-1" />
          View Responses
        </rs-button>
        <rs-button @click="openAddQuestionnaireModal">
          <Icon name="material-symbols:add" class="mr-1" />
          Add Questionnaire
        </rs-button>
      </div>
    </div>
    <div v-if="message" class="mb-4 p-3 rounded text-white"
        :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
      {{ message }}
    </div>

    <!-- Loading indicator -->
    <div v-if="isLoading" class="flex justify-center my-8">
      <div class="flex flex-col items-center">
        <Icon name="line-md:loading-twotone-loop" size="48" class="text-primary mb-2" />
        <span>Loading questionnaires...</span>
      </div>
    </div>

    <!-- No data display -->
    <div v-else-if="questionnaires.length === 0" class="card p-8 text-center">
      <div class="flex flex-col items-center">
        <Icon name="material-symbols:folder-off-outline" size="64" class="text-gray-400 mb-4" />
        <h3 class="text-xl font-medium text-gray-600 mb-2">No Questionnaires Found</h3>
        <p class="text-gray-500 mb-6">There are no questionnaires in the system yet.</p>
        <rs-button @click="openAddQuestionnaireModal">
          <Icon name="material-symbols:add" class="mr-1" />
          Create Your First Questionnaire
        </rs-button>
      </div>
    </div>

    <!-- Questionnaire list -->
    <div v-else v-for="q in questionnaires" :key="q.id" class="card mb-6 p-4">
      <div class="flex justify-between items-center mb-2">
        <div>
          <h2 class="text-xl font-semibold">{{ q.name }}</h2>
          <p class="text-sm text-gray-500">{{ q.description }} | <span :class="q.status === 'Active' ? 'text-green-600' : 'text-red-500'">{{ q.status }}</span></p>
          <p class="text-sm text-gray-500 mt-1">
            <span class="font-medium">Questions:</span> {{ q.questions.length }}
          </p>
        </div>
        <div class="flex gap-2 items-center">
          <div class="flex items-center gap-2 mr-2">
            <span class="text-sm text-gray-500">Status:</span>
            <input
              type="checkbox"
              class="toggle-checkbox"
              :checked="q.status === 'Active'"
              @click.prevent="confirmToggleStatus(q)"
            />
          </div>
          <rs-button size="sm" @click="openEditQuestionnaireModal(q)">
            <Icon name="material-symbols:edit-outline-rounded" />
          </rs-button>
          <rs-button size="sm" @click="() => {
            console.log('Navigating to questions page with questionnaire ID:', q.id);
            router.push(`/questionnaire/questions/${q.id}`);
          }">
            <Icon
              name="material-symbols:list-alt-outline"
              class="text-blue-500 hover:text-blue-600 cursor-pointer"
              size="22"
              title="Manage Questions"
            />
          </rs-button>
          <rs-button size="sm" @click="router.push(`/questionnaire/thresholds/${q.id}`)">
            <Icon
              name="material-symbols:analytics-outline"
              class="text-purple-500 hover:text-purple-600 cursor-pointer"
              size="22"
              title="Manage Scoring Thresholds"
            />
          </rs-button>
          <Icon
            name="material-symbols:play-arrow-rounded"
            class="text-green-500 hover:text-green-600 cursor-pointer"
            size="22"
            @click="router.push(`/questionnaire/take/${q.id}`)"
            title="Take Questionnaire"
          />
          <Icon
            name="material-symbols:delete-outline"
            class="text-red-500 hover:text-red-700 cursor-pointer"
            size="22"
            @click="confirmDelete(q)"
            title="Delete Questionnaire"
          />
        </div>
      </div>
    </div>

    <!-- Add a help section explaining the workflow -->
    <div class="card p-4 mb-6 bg-blue-50 border border-blue-200">
      <h3 class="font-semibold text-lg mb-2">How to Create a Complete Questionnaire</h3>
      <ol class="list-decimal ml-6 space-y-2">
        <li>Create a questionnaire using the <strong>Add Questionnaire</strong> button</li>
        <li>Add questions to your questionnaire using the <strong>Manage Questions</strong> button</li>
        <li>For each question, add answer options using the <strong>Manage Options</strong> button</li>
        <li>Define scoring thresholds using the <strong>Manage Scoring Thresholds</strong> button to provide interpretations based on total scores</li>
        <li>Once you've added options to your questions, use the <strong>Take Questionnaire</strong> button to test it</li>
        <li>View responses using the <strong>View Responses</strong> button</li>
      </ol>
    </div>

    <!-- Add/Edit Questionnaire Modal -->
    <rs-modal
      :title="isEditingQuestionnaire ? 'Edit Questionnaire' : 'Add Questionnaire'"
      cancel-title="Cancel"
      v-model="showQuestionnaireModal"
      :overlay-close="false"
      :hide-footer="true"
    >
      <div v-if="modalErrorMessage" class="mb-3 p-2 rounded bg-red-100 text-red-700 border border-red-300">
        {{ modalErrorMessage }}
      </div>

      <FormKit type="form" @submit="saveQuestionnaire" :actions="false">
        <FormKit
          type="text"
          v-model="newQuestionnaire.name"
          name="questionnaireName"
          label="Questionnaire Name"
          placeholder="Enter questionnaire title"
          validation="required"
          validation-visibility="dirty"
          :validation-messages="{ required: 'This field is required' }"
        />
        <FormKit
          type="text"
          v-model="newQuestionnaire.description"
          name="questionnaireDescription"
          label="Questionnaire Description"
          placeholder="Enter questionnaire description"
          validation="required"
          validation-visibility="dirty"
          :validation-messages="{ required: 'This field is required' }"
        />
        <FormKit
          type="select"
          v-model="newQuestionnaire.status"
          name="questionnaireStatus"
          label="Questionnaire Status"
          :options="[
            { label: '-- Please select --', value: '' },
            { label: 'Active', value: 'Active' },
            { label: 'Inactive', value: 'Inactive' }
          ]"
          validation="required"
          validation-visibility="dirty"
          :validation-messages="{ required: 'This field is required' }"
        />

        <!-- Custom Footer -->
        <div class="flex justify-end gap-2 mt-4">
          <button
            type="button"
            class="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 text-black"
            @click="showQuestionnaireModal = false"
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

    <!-- Toggle confirmation modal -->
    <rs-modal
      title="Confirmation"
      ok-title="Yes"
      cancel-title="No"
      :ok-callback="performToggleStatus"
      :cancel-callback="cancelToggleStatus"
      v-model="showConfirmToggleModal"
      :overlay-close="false"
    >
      <p>
        Are you sure you want to
        <span v-if="pendingToggleQuestionnaire?.status === 'Active'">deactivate</span>
        <span v-else>activate</span>
        this questionnaire ({{ pendingToggleQuestionnaire?.name }})?
      </p>

      <div v-if="isTogglingStatus" class="flex justify-center items-center mt-4 p-2 bg-blue-50 rounded-md">
        <Icon name="line-md:loading-twotone-loop" class="text-primary mr-2" />
        <span>Updating status...</span>
      </div>
    </rs-modal>

    <!-- Delete confirmation modal -->
    <rs-modal
      title="Delete Questionnaire"
      ok-title="Delete"
      cancel-title="Cancel"
      :ok-callback="performDelete"
      :cancel-callback="cancelDelete"
      v-model="showDeleteModal"
      :overlay-close="false"
    >
      <p class="mb-4">
        Are you sure you want to delete this questionnaire ({{ pendingDeleteQuestionnaire?.name }})?
      </p>
      <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <Icon name="material-symbols:warning" class="text-yellow-400" />
          </div>
          <div class="ml-3">
            <p class="text-sm text-yellow-700">
              This will also delete all associated questions, options, and responses. This action cannot be undone.
            </p>
          </div>
        </div>
      </div>

      <div v-if="isDeleting" class="flex justify-center items-center mt-4 p-2 bg-blue-50 rounded-md">
        <Icon name="line-md:loading-twotone-loop" class="text-primary mr-2" />
        <span>Deleting...</span>
      </div>
    </rs-modal>
  </div>
</template>
