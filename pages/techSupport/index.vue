<script setup>
import { ref, onMounted } from 'vue'

const supportContacts = ref([])
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

function normalizeStatus(status) {
  return String(status || '').toUpperCase() === 'ACTIVE' ? 'Active' : 'Inactive'
}

async function fetchContacts() {
  loading.value = true
  error.value = ''
  try {
    const data = await $fetch('/api/techSupport/list')
    supportContacts.value = Array.isArray(data) ? data : []
  } catch (e) {
    error.value = 'Failed to load tech support contacts'
    supportContacts.value = []
  }
  loading.value = false
}

function openEditModal(contact) {
  form.value = {
    techSupport_name: contact.techSupport_name || '',
    techSupport_email: contact.techSupport_email || '',
    techSupport_phone: contact.techSupport_phone || '',
    techSupport_status: normalizeStatus(contact.techSupport_status),
  }
  isEdit.value = true
  editId.value = contact.id
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

  try {
    const res = await $fetch(`/api/techSupport/update?id=${editId.value}`, {
      method: 'PUT',
      body: {
        techSupport_name: form.value.techSupport_name,
        techSupport_email: form.value.techSupport_email,
        techSupport_phone: form.value.techSupport_phone,
        techSupport_status: form.value.techSupport_status,
      },
    })

    if (res.statusCode === 200) {
      showModal.value = false
      successMessage.value = 'Tech support contact updated successfully!'
      await fetchContacts()
      setTimeout(() => {
        successMessage.value = ''
      }, 3000)
    } else {
      error.value = res.message || 'Failed to update tech support contact'
    }
  } catch (e) {
    error.value = e.data?.message || e.message || 'Failed to update tech support contact'
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
      <rs-table
        :data="supportContacts"
        :field="['no', 'supportType', 'contact', 'status', 'action']"
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
          {{ data.value.techSupport_name }}
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
          <rs-badge :variant="String(data.value.techSupport_status).toUpperCase() === 'ACTIVE' ? 'success' : 'danger'">
            {{ data.value.techSupport_status }}
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
    </div>

    <rs-modal
      title="Edit Tech Support"
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
