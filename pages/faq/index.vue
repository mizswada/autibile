<script setup>
import { ref, onMounted } from 'vue'

const questions = ref([])
const showModal = ref(false)
const showDeleteModal = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const deleteId = ref(null)
const deleteQuestionText = ref('')
const newQuestion = ref({
  faq_language: '',
  faq_question: '',
  faq_answer: '',
  faq_status: 'active',
})
const languageOptions = ref([])

const loading = ref(false)
const error = ref('')
const successMessage = ref('')

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

async function fetchLanguages() {
  try {
    const data = await $fetch('/api/faq/languages')
    languageOptions.value = data
  } catch (e) {
    console.error('Failed to load languages', e)
  }
}

function toggleQuestion(id) {
  const q = questions.value.find(q => q.id === id)
  if (q) q.faq_status = q.faq_status === 'active' ? 'inactive' : 'active'
}

function openAddModal() {
  newQuestion.value = {
    faq_language: '',
    faq_question: '',
    faq_answer: '',
    faq_status: 'active',
  }
  isEdit.value = false
  editId.value = null
  showModal.value = true
  error.value = ''
  successMessage.value = ''
}

function openEditModal(q) {
  newQuestion.value = {
    faq_language: q.faq_language_id,
    faq_question: q.faq_question,
    faq_answer: q.faq_answer,
    faq_status: q.faq_status,
  }
  isEdit.value = true
  editId.value = q.id
  showModal.value = true
  error.value = ''
  successMessage.value = ''
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
    successMessage.value = isEdit.value ? 'FAQ updated successfully!' : 'FAQ added successfully!'
    await fetchQuestions()
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (e) {
    error.value = e.data?.message || e.message || 'Failed to save FAQ'
  }
}

function confirmDelete(id, questionText) {
  deleteId.value = id
  deleteQuestionText.value = questionText
  showDeleteModal.value = true
}

async function deleteQuestion() {
  try {
    await $fetch(`/api/faq/delete?id=${deleteId.value}`, { method: 'DELETE' })
    showDeleteModal.value = false
    successMessage.value = 'FAQ deleted successfully!'
    await fetchQuestions()
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (e) {
    error.value = 'Failed to delete FAQ'
  }
}

onMounted(async () => {
  await fetchLanguages()
  await fetchQuestions()
})
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Manage FAQ</h1>
    
    <!-- Success Message -->
    <div v-if="successMessage" class="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
      {{ successMessage }}
    </div>
    
    <!-- Error Message -->
    <div v-if="error" class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
      {{ error }}
    </div>
    <div class="flex justify-end mb-2">
      <rs-button @click="openAddModal">
        <Icon name="material-symbols:add" class="mr-1" />
        Add FAQ
      </rs-button>
    </div>
    <div class="card p-4 mt-4">
      <rs-table
        :data="questions"
        :field="['no', 'language', 'question', 'answer', 'status', 'action']"
        :options="{
          variant: 'default',
          striped: true,
          borderless: true,
        }"
        :options-advanced="{
          sortable: true,
          responsive: true,
          filterable: false,
        }"
        advanced
      >
        <template v-slot:no="data">
          {{ data.value.no }}
        </template>
        <template v-slot:language="data">
          {{ data.value.faq_language }}
        </template>
        <template v-slot:question="data">
          {{ data.value.faq_question }}
        </template>
        <template v-slot:answer="data">
          <div class="max-w-md truncate">
            {{ data.value.faq_answer }}
          </div>
        </template>
        <template v-slot:status="data">
          <rs-badge :variant="data.value.faq_status === 'active' ? 'success' : 'danger'">
            {{ data.value.faq_status === 'active' ? 'Active' : 'Inactive' }}
          </rs-badge>
        </template>
        <template v-slot:action="data">
          <div class="flex justify-center items-center">
            <Icon
              name="material-symbols:edit-outline-rounded"
              class="text-primary hover:text-primary/90 cursor-pointer mr-3"
              size="22"
              @click="openEditModal(data.value)"
            ></Icon>
            <Icon
              name="material-symbols:close-rounded"
              class="text-primary hover:text-primary/90 cursor-pointer"
              size="22"
              @click="confirmDelete(data.value.id, data.value.faq_question)"
            ></Icon>
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
        v-model="newQuestion.faq_language"
        name="language"
        label="Language"
        :options="languageOptions"
        option-value="value"
        option-label="label"
        placeholder="Select language"
        validation="required"
      />
      <FormKit
        type="text"
        v-model="newQuestion.faq_question"
        name="faqQuestion"
        label="FAQ Question"
        placeholder="Enter FAQ question"
        validation="required"
      />
      <FormKit 
        type="textarea"
        v-model="newQuestion.faq_answer" 
        name="faqAnswer" 
        rows="8" 
        label="Answer"
        validation="required"
      />
      <FormKit
        type="select"
        v-model="newQuestion.faq_status"
        name="status"
        label="Status"
        :options="[
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' }
        ]"
        option-value="value"
        option-label="label"
      />
    </rs-modal>
    
    <!-- Delete Confirmation Modal -->
    <rs-modal
      title="Confirm Delete"
      ok-title="Delete"
      cancel-title="Cancel"
      :ok-callback="deleteQuestion"
      v-model="showDeleteModal"
      :overlay-close="false"
      ok-variant="danger"
    >
      <div class="p-4">
        <p class="text-gray-700 mb-4">Are you sure you want to delete this FAQ?</p>
        <div class="bg-gray-100 p-3 rounded">
          <p class="font-medium text-gray-800">Question:</p>
          <p class="text-gray-600">{{ deleteQuestionText }}</p>
        </div>
        <p class="text-red-600 text-sm mt-3">This action cannot be undone.</p>
      </div>
    </rs-modal>
  </div>
</template>