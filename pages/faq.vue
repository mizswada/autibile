<script setup>
import { ref } from 'vue';

const questions = ref([
  { id: 1, question: "What is the purpose of this app?", answer: "Our app is designed to support individuals on the autism spectrum by providing tools for communication, emotional regulation, learning, and daily routines. It also offers resources and tracking features for caregivers, therapists, and educators.", enabled: true, action: "edit" },
  { id: 2, question: "Who can use this app?", answer: "The app is suitable for children, teens, and adults on the autism spectrum, as well as parents, caregivers, therapists, and teachers. Features can be customized to match individual needs and developmental levels.", enabled: true, action: "edit" },
  { id: 3, question: "Is the app suitable for non-verbal users?", answer: "Yes, the app includes alternative communication tools such as visual schedules, symbol-based communication boards, and voice output features to support non-verbal or minimally verbal users.", enabled: false, action: "edit" },
  { id: 4, question: "Does the app offer progress tracking or reporting?", answer: "Yes, caregivers and educators can track progress in key developmental areas such as communication, social interaction, and behavior. Reports can be generated and shared with professionals to support therapy or education plans.", enabled: true, action: "edit" },
  { id: 5, question: "Can the app be customized for individual needs?", answer: "Absolutely! The app allows users to customize features such as visual schedules, communication boards, and sensory tools to match their specific preferences and needs. Caregivers can also set reminders and alerts tailored to the user's routine.", enabled: true, action: "edit" },
  { id: 6, question: "Is there a community support feature?", answer: "Yes, the app includes a community support section where users can connect with others on the autism spectrum, share experiences, ask questions, and find resources. Moderated forums ensure a safe environment for discussion.", enabled: true, action: "edit" },
  { id: 7, question: "How does the app handle sensory sensitivities?", answer: "The app provides sensory-friendly features such as customizable color schemes, sound controls, and calming tools like breathing exercises and visual relaxation aids to help users manage sensory sensitivities effectively.", enabled: false, action: "edit" },
  { id: 8, question: "Can I access the app offline?", answer: "Yes, many features of the app can be accessed offline. Users can download content such as visual schedules and communication boards for use without an internet connection.", enabled: true, action: "edit" },
  { id: 9, question: "Is there a cost associated with using the app?", answer: "The app is free to download and use with basic features. Additional premium features may be available through in-app purchases or subscriptions to enhance functionality.", enabled: true, action: "edit" },
]);

const showModal = ref(false);
const isEdit = ref(false);
const editId = ref(null);
const newQuestion = ref({
  question: '',
  answer: '',
  enabled: true,
});

function toggleQuestion(id) {
  const q = questions.value.find(q => q.id === id);
  if (q) q.enabled = !q.enabled;
}

function openAddModal() {
  newQuestion.value = { question: '', answer: '', enabled: true };
  isEdit.value = false;
  editId.value = null;
  showModal.value = true;
}

function openEditModal(q) {
  newQuestion.value = { question: q.question, answer: q.answer, enabled: q.enabled };
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
          answer: newQuestion.value.answer,
          enabled: newQuestion.value.enabled,
        };
      }
    } else {
      // Add new
      questions.value.push({
        id: Date.now(),
        question: newQuestion.value.question,
        answer: newQuestion.value.answer,
        enabled: newQuestion.value.enabled,
        action: "edit",
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
    <h1 class="text-2xl font-bold">Manage FAQ</h1>
    <div class="flex justify-end mb-2">
      <rs-button @click="openAddModal">
        <Icon name="material-symbols:add" class="mr-1" />
        Add FAQ
      </rs-button>
    </div>
    <div class="card p-4 mt-4">
      <rs-table
        :data="questions"
        :columns="[
          { name: 'question', label: 'FAQ Question' },
          { name: 'status', label: 'Status', slot: true },
          { name: 'action', label: 'Actions', slot: true }
        ]"
        :options="{ borderless: true }"
        advanced
      >
        <template #status="slotProps">
          <span :class="slotProps.row.enabled ? 'text-green-600 font-semibold' : 'text-gray-400'">
            {{ slotProps.row.enabled ? 'Enabled' : 'Inactive' }}
          </span>
        </template>
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
      :title="isEdit ? 'Edit FAQ' : 'Add FAQ'"
      ok-title="Save"
      cancel-title="Cancel"
      :ok-callback="saveQuestion"
      v-model="showModal"
      :overlay-close="false"
    >
      <FormKit
        type="text"
        v-model="newQuestion.question"
        name="faqText"
        label="FAQ Question"
        placeholder="Enter FAQ question"
      />
      <FormKit 
        type="textarea"
        v-model="newQuestion.answer" 
        name="Answer" 
        rows="8" 
        label="Answer"/>
      <div class="mt-2">
        <label class="block font-medium mb-1">Status</label>
        <label class="mr-4">
          <input
            type="radio"
            value="true"
            v-model="newQuestion.enabled"
            :checked="newQuestion.enabled === true"
            @change="newQuestion.enabled = true"
          />
          Enabled
        </label>
        <label>
          <input
            type="radio"
            value="false"
            v-model="newQuestion.enabled"
            :checked="newQuestion.enabled === false"
            @change="newQuestion.enabled = false"
          />
          Inactive
        </label>
      </div>
    </rs-modal>
  </div>
</template>