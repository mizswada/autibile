<script setup>
import { ref, onMounted } from 'vue'

const questions = ref([])
const showModal = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const newQuestion = ref({
  faq_language: '',
  faq_question: '',
  faq_answer: '',
  faq_status: true,
})

const loading = ref(false)
const error = ref('')

async function fetchQuestions() {
  loading.value = true
  error.value = ''
  try {
    const data = await $fetch('/api/faq/list')
    questions.value = data
  } catch (e) {
    error.value = 'Failed to load FAQ'
  }
  loading.value = false
}

function toggleQuestion(id) {
  const q = questions.value.find(q => q.id === id)
  if (q) q.faq_status = !q.faq_status
}

function openAddModal() {
  newQuestion.value = {
    faq_language: '',
    faq_question: '',
    faq_answer: '',
    faq_status: true,
  }
  isEdit.value = false
  editId.value = null
  showModal.value = true
}

function openEditModal(q) {
  newQuestion.value = {
    faq_language: q.faq_language,
    faq_question: q.faq_question,
    faq_answer: q.faq_answer,
    faq_status: q.faq_status,
  }
  isEdit.value = true
  editId.value = q.id
  showModal.value = true
}

async function saveQuestion() {
  if (!newQuestion.value.faq_question.trim() || !newQuestion.value.faq_answer.trim() || !newQuestion.value.faq_language) {
    error.value = 'All fields are required'
    return
  }
  try {
    if (isEdit.value && editId.value !== null) {
      await $fetch(`/api/faq/update?id=${editId.value}`, {
        method: 'PUT',
        body: {
          faq_languange: newQuestion.value.faq_language,
          faq_question: newQuestion.value.faq_question,
          faq_answer: newQuestion.value.faq_answer,
          faq_status: newQuestion.value.faq_status,
        }
      })
    } else {
      await $fetch('/api/faq/add', {
        method: 'POST',
        body: {
          faq_language: newQuestion.value.faq_language,
          faq_question: newQuestion.value.faq_question,
          faq_answer: newQuestion.value.faq_answer,
          faq_status: newQuestion.value.faq_status,
        }
      })
    }
    showModal.value = false
    await fetchQuestions()
  } catch (e) {
    error.value = e.data?.message || e.message || 'Failed to save FAQ'
  }
}

async function deleteQuestion(id) {
  try {
    await $fetch(`/api/faq/delete?id=${id}`, { method: 'DELETE' })
    await fetchQuestions()
  } catch (e) {
    error.value = 'Failed to delete FAQ'
  }
}

onMounted(fetchQuestions)
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
          type="select"
          v-model="newQuestion.lanquage"
          name="language"
          label="Language"
          :options="['-- Please select --', 'Bahasa Melayu', 'Engilsh']"
          validation="required"
        />
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