<script setup>
import { ref } from 'vue';

const questions = ref([
  { id: 1, question: "Does your child respond to their name?",action: "edit" },
  { id: 2, question: "Does your child make eye contact?",action: "edit" },
  { id: 3, question: "Does your child use gestures to communicate?",action: "edit" }, 
  { id: 4, question: "Does your child play with other children?",action: "edit" },
  { id: 5, question: "Does your child have a limited range of interests?",action: "edit" },
  { id: 6, question: "Does your child have difficulty understanding social cues?",action: "edit" },
  { id: 7, question: "Does your child have repetitive behaviors or routines?",action: "edit" },
  { id: 8, question: "Does your child have difficulty with changes in routine?",action: "edit" },
  { id: 9, question: "Does your child have sensory sensitivities?",action: "edit" },
]);

const showModal = ref(false);
const isEdit = ref(false);
const editId = ref(null);
const newQuestion = ref({
  question: '',
});

function openAddModal() {
  newQuestion.value = { question: '' };
  isEdit.value = false;
  editId.value = null;
  showModal.value = true;
}

function openEditModal(q) {
  newQuestion.value = { question: q.question };
  isEdit.value = true;
  editId.value = q.id;
  showModal.value = true;
}

function saveQuestion() {
  if (newQuestion.value.question.trim()) {
    if (isEdit.value && editId.value !== null) {
      // Edit existing
      const idx = questions.value.findIndex(q => q.id === editId.value);
      if (idx !== -1) {
        questions.value[idx] = {
          ...questions.value[idx],
          question: newQuestion.value.question,
        };
      }
    } else {
      // Add new
      questions.value.push({
        id: Date.now(),
        question: newQuestion.value.question,
      });
    }
    showModal.value = false;
  }
}

function deleteQuestion(id) {
  questions.value = questions.value.filter(q => q.id !== id);
}
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Manage Questionnaire</h1>
    <div class="flex justify-end mb-2">
      <rs-button @click="openAddModal">
        <Icon name="material-symbols:add" class="mr-1" />
        Add Question
      </rs-button>
    </div>
    <div class="card p-4 mt-4">
      <rs-table
        :data="questions"
        :columns="
          [
            { name: 'question', label: 'Question' },
            { name: 'action', label: 'Actions', slot: true }
          ]
        "
        :options="{ borderless: true }"
        advanced
      >
        <template #action="slotProps">
          <div class="flex gap-2">
            <rs-button size="sm" @click="openEditModal(slotProps.row)">
              <Icon name="material-symbols:edit-outline-rounded" />
            </rs-button>
            <rs-button size="sm" variant="danger" @click="deleteQuestion(slotProps.row.id)">
              <Icon name="material-symbols:delete-outline" />
            </rs-button>
          </div>
        </template>
      </rs-table>
    </div>
    <rs-modal
      :title="isEdit ? 'Edit Question' : 'Add Question'"
      ok-title="Save"
      cancel-title="Cancel"
      :ok-callback="saveQuestion"
      v-model="showModal"
      :overlay-close="false"
    >
      <FormKit
        type="text"
        v-model="newQuestion.question"
        name="questionText"
        label="Question"
        placeholder="Enter question"
      />
    </rs-modal>
  </div>
</template>