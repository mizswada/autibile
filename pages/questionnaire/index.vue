<script setup>
import { ref, onMounted } from 'vue';

const modalErrorMessage = ref('');
const questionnaires = ref([]);

const showQuestionnaireModal = ref(false);
const newQuestionnaire = ref({ name: '', description: '', status: '' });
const isEditingQuestionnaire = ref(false);
const editQuestionnaireId = ref(null);

const showQuestionModal = ref(false);
const currentQuestionnaireId = ref(null);
const newQuestion = ref({ question: '' });
const isEditingQuestion = ref(false);
const editQuestionId = ref(null);
const message = ref('');
const messageType = ref('success'); // 'success' or 'error'

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
    const res = await fetch('/api/questionnaire/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (res.ok && result.data) {
      questionnaires.value.push({
        id: result.data.id,
        name: result.data.title,
        description: result.data.description,
        status: result.data.status,
        questions: [],
      })
      showQuestionnaireModal.value = false
      modalErrorMessage.value = ''
      showMessage('Questionnaire inserted successfully.', 'success')
    } else {
      console.error('Failed to insert questionnaire:', result.message);
      modalErrorMessage.value = result.message || 'Failed to insert questionnaire.';
    }
  } catch (err) {
    console.error('Error while inserting questionnaire:', err);
  }
}


async function deleteQuestionnaire(id) {
  const confirmDelete = confirm('Are you sure you want to delete this questionnaire and all its questions?');
  if (!confirmDelete) return;

  try {
    const res = await fetch(`/api/questionnaire/delete?questionnaireID=${id}`, {
      method: 'DELETE',
    });
    const result = await res.json();

    if (res.ok) {
      questionnaires.value = questionnaires.value.filter(q => q.id !== id);
      showMessage('Questionnaire deleted successfully.', 'success');
    } else {
      showMessage(result.message || 'Failed to delete questionnaire', 'error');
    }
  } catch (err) {
    console.error('Delete error:', err);
    showMessage('Internal server error', 'error');
  }
}



function openAddQuestionModal(questionnaireId) {
  currentQuestionnaireId.value = questionnaireId;
  newQuestion.value = {
    question_bm: '',
    question_en: '',
    requiredQuestion: '',
    status: '',
  };
  isEditingQuestion.value = false;
  editQuestionId.value = null;
  showQuestionModal.value = true;
}

function openEditQuestionModal(questionnaireId, question) {
  currentQuestionnaireId.value = questionnaireId
  newQuestion.value = {
    question_bm: question.question_bm,
    question_en: question.question_en,
    requiredQuestion: question.requiredQuestion,
    status: question.status
  }
  isEditingQuestion.value = true
  editQuestionId.value = question.id
  showQuestionModal.value = true
}

async function saveQuestion() {
  const questionnaire = questionnaires.value.find(q => q.id === currentQuestionnaireId.value);
  if (!questionnaire) return;

  const payload = {
    questionnaire_id: currentQuestionnaireId.value,
    question_bm: newQuestion.value.question_bm,
    question_en: newQuestion.value.question_en,
    requiredQuestion: newQuestion.value.requiredQuestion,
    status: newQuestion.value.status,
  };

  try {
    const res = await fetch('/api/questionnaire/questions/insertQuestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (res.ok && result.data) {
      showQuestionModal.value = false;
      modalErrorMessage.value = '';
      showMessage('Question inserted successfully.', 'success');

      // 🔁 Auto-refresh the full list (to get updated questions)
      await fetchQuestionnaires();
    } else {
      console.error('Failed to insert question:', result.message);
      modalErrorMessage.value = result.message || 'Failed to insert question.';
    }
  } catch (err) {
    console.error('Error inserting question:', err);
  }
}


async function deleteQuestion(questionnaireId, questionId) {
  const confirmDelete = confirm('Are you sure you want to delete this question?');
  if (!confirmDelete) return;

  try {
    const res = await fetch(`/api/questionnaire/questions/deleteQuestions?questionID=${questionId}`, {
      method: 'DELETE',
    });
    const result = await res.json();

    if (res.ok) {
      const questionnaire = questionnaires.value.find(q => q.id === questionnaireId);
      if (questionnaire) {
        questionnaire.questions = questionnaire.questions.filter(q => q.id !== questionId);
      }
      showMessage('Question deleted successfully.', 'success');
    } else {
      showMessage(result.message || 'Failed to delete question', 'error');
    }
  } catch (err) {
    console.error('Delete error:', err);
    showMessage('Internal server error', 'error');
  }
}


</script>

<style>
.formkit-label::after {
  content: '*';
  color: red;
  margin-left: 4px;
}
</style>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Questionnaire Management</h1>
    <div v-if="message" class="mb-4 p-3 rounded text-white"
        :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
      {{ message }}
    </div>


    <div class="flex justify-end mb-4">
      <rs-button @click="openAddQuestionnaireModal">
        <Icon name="material-symbols:add" class="mr-1" />
        Add Questionnaire
      </rs-button>
    </div>

    <div v-for="q in questionnaires" :key="q.id" class="card mb-6 p-4">
      <div class="flex justify-between items-center mb-2">
        <div>
          <h2 class="text-xl font-semibold">{{ q.name }}</h2>
          <p class="text-sm text-gray-500">{{ q.description }} | <span :class="q.status === 'Active' ? 'text-green-600' : 'text-red-500'">{{ q.status }}</span></p>
        </div>
        <div class="flex gap-2">
          <rs-button size="sm" @click="openEditQuestionnaireModal(q)">
            <Icon name="material-symbols:edit-outline-rounded" />
          </rs-button>
          <rs-button size="sm" variant="danger" @click="deleteQuestionnaire(q.id)">
            <Icon name="material-symbols:delete-outline" />
          </rs-button>
          <rs-button size="sm" @click="openAddQuestionModal(q.id)">
            <Icon name="material-symbols:add" class="mr-1" />
            Add Question
          </rs-button>
        </div>
      </div>

      <rs-table
        :data="q.questions"
        :columns="[
          { name: 'question', label: 'Question' },
          { name: 'action', label: 'Actions', slot: true }
        ]"
        :options="{ borderless: true }"
      >
        <template #action="slotProps">
          <div class="flex gap-2">
              <Icon
                name="material-symbols:edit-outline-rounded"
                class="text-primary hover:text-primary/90 cursor-pointer"
                size="22"
                @click="openEditQuestionModal(q.id, slotProps.value)"
              />

              <!-- Delete Button -->
              <Icon
                name="material-symbols:close-rounded"
                class="text-primary hover:text-primary/90 cursor-pointer"
                size="22"
                @click="deleteQuestion(q.id, slotProps.value.id)"
              />
          </div>
        </template>
      </rs-table>
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


    <!-- Add/Edit Question Modal -->
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


  </div>
</template>
