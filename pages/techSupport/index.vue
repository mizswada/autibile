<script setup>
import { ref, onMounted } from 'vue'

const supportContacts = ref([])
const tableKey = ref(0)
const loading = ref(false)
const error = ref('')
const successMessage = ref('')
const showModal = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const form = ref({
  techSupport_name: '',
  techSupport_email: '',
  techSupport_phone: '',
  techSupport_status: 'Active',
})

const tableFields = ['no', 'supportType', 'contact', 'status', 'action']

function normalizeStatus(status) {
  return String(status || '').toUpperCase() === 'ACTIVE' ? 'Active' : 'Inactive'
}

function resetForm() {
  form.value = {
    techSupport_name: '',
    techSupport_email: '',
    techSupport_phone: '',
    techSupport_status: 'Active',
  }
}

async function fetchContacts() {
  loading.value = true
  try {
    const data = await $fetch('/api/techSupport/list')

    if (Array.isArray(data)) {
      supportContacts.value = data
      tableKey.value += 1
      error.value = ''
    } else {
      error.value = data?.message || 'Failed to load tech support contacts'
    }
  } catch (e) {
    error.value = e.data?.message || e.message || 'Failed to load tech support contacts'
  } finally {
    loading.value = false
  }
}

function openAddModal() {
  resetForm()
  isEdit.value = false
  editId.value = null
  showModal.value = true
  error.value = ''
  successMessage.value = ''
}

function openEditModal(contact) {
  const id = contact?.id ?? contact?.techSupport_ID
  if (!id) {
    error.value = 'Unable to edit: missing tech support ID'
    return
  }

  form.value = {
    techSupport_name: contact.techSupport_name || contact.supportType || '',
    techSupport_email: contact.techSupport_email || '',
    techSupport_phone: contact.techSupport_phone || contact.contact || '',
    techSupport_status: normalizeStatus(contact.techSupport_status || contact.status),
  }
  isEdit.value = true
  editId.value = id
  showModal.value = true
  error.value = ''
  successMessage.value = ''
}

async function saveContact() {
  if (
    !form.value.techSupport_name.trim() ||
    !form.value.techSupport_email.trim() ||
    !form.value.techSupport_phone.trim() ||
    !form.value.techSupport_status
  ) {
    error.value = 'All fields are required'
    return
  }

  if (isEdit.value && !editId.value) {
    error.value = 'Unable to save: missing tech support ID'
    return
  }

  try {
    const body = {
      techSupport_name: form.value.techSupport_name.trim(),
      techSupport_email: form.value.techSupport_email.trim(),
      techSupport_phone: form.value.techSupport_phone.trim(),
      techSupport_status: form.value.techSupport_status,
    }

    const res = isEdit.value
      ? await $fetch(`/api/techSupport/update?id=${editId.value}`, {
          method: 'PUT',
          body,
        })
      : await $fetch('/api/techSupport/add', {
          method: 'POST',
          body,
        })

    if (res.statusCode === 200) {
      showModal.value = false
      successMessage.value = isEdit.value
        ? 'Tech support contact updated successfully!'
        : 'Tech support contact added successfully!'
      await fetchContacts()
      setTimeout(() => {
        successMessage.value = ''
      }, 3000)
    } else {
      error.value = res.message || 'Failed to save tech support contact'
    }
  } catch (e) {
    error.value = e.data?.message || e.message || 'Failed to save tech support contact'
  }
}

onMounted(fetchContacts)
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Technical Support</h1>

    <div v-if="successMessage" class="mb-4 mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
      {{ successMessage }}
    </div>

    <div v-if="error" class="mb-4 mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
      {{ error }}
    </div>

    <div class="card p-4 mt-4">
      <div class="flex justify-end mb-4">
        <rs-button @click="openAddModal">
          <Icon name="material-symbols:add" class="mr-1" />
          Add New Tech Support
        </rs-button>
      </div>

      <div v-if="loading && supportContacts.length === 0" class="flex justify-center my-8">
        <div class="flex flex-col items-center">
          <Icon name="line-md:loading-twotone-loop" size="48" class="text-primary mb-2" />
          <span>Loading tech support contacts...</span>
        </div>
      </div>

      <rs-table
        v-else-if="supportContacts.length > 0"
        :key="tableKey"
        :data="supportContacts"
        :field="tableFields"
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
        <template v-slot:supportType="data">
          <div class="flex items-center gap-2">
            <span>{{ data.value.techSupport_name || data.value.supportType }}</span>
            <rs-badge
              v-if="data.value.isDefault || data.value.id === 1"
              variant="info"
            >
              Default
            </rs-badge>
          </div>
        </template>
        <template v-slot:contact="data">
          <div>
            <div>
              <a :href="`tel:${data.value.techSupport_phone}`" class="text-primary underline">
                {{ data.value.techSupport_phone }}
              </a>
            </div>
            <div>
              <a :href="`mailto:${data.value.techSupport_email}`" class="text-primary underline">
                {{ data.value.techSupport_email }}
              </a>
            </div>
          </div>
        </template>
        <template v-slot:status="data">
          <rs-badge :variant="String(data.value.techSupport_status || data.value.status).toUpperCase() === 'ACTIVE' ? 'success' : 'danger'">
            {{ data.value.techSupport_status || data.value.status }}
          </rs-badge>
        </template>
        <template v-slot:action="data">
          <div class="flex justify-center items-center">
            <Icon
              name="material-symbols:edit-outline-rounded"
              class="text-primary hover:text-primary/90 cursor-pointer"
              size="22"
              @click="openEditModal(data.value)"
            ></Icon>
          </div>
        </template>
      </rs-table>

      <div v-else class="text-center text-gray-500 py-8">
        No tech support contacts found.
      </div>
    </div>

    <rs-modal
      :title="isEdit ? 'Edit Tech Support' : 'Add New Tech Support'"
      ok-title="Save"
      cancel-title="Cancel"
      :ok-callback="saveContact"
      v-model="showModal"
      :overlay-close="false"
    >
      <FormKit
        type="text"
        v-model="form.techSupport_name"
        name="techSupport_name"
        label="Support Type"
        placeholder="Enter support type"
        validation="required"
      />
      <FormKit
        type="email"
        v-model="form.techSupport_email"
        name="techSupport_email"
        label="Email"
        placeholder="Enter email"
        validation="required|email"
      />
      <FormKit
        type="text"
        v-model="form.techSupport_phone"
        name="techSupport_phone"
        label="Phone Number"
        placeholder="Enter phone number"
        validation="required"
      />
      <FormKit
        type="select"
        v-model="form.techSupport_status"
        name="techSupport_status"
        label="Status"
        :options="[
          { label: 'Active', value: 'Active' },
          { label: 'Inactive', value: 'Inactive' },
        ]"
        option-value="value"
        option-label="label"
      />
    </rs-modal>
  </div>
</template>
