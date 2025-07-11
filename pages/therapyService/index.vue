<script setup>
import { ref, onMounted } from 'vue'

const services = ref([])
const loading = ref(false)
const error = ref('')
const showModal = ref(false)
const showModalDelete = ref(false)
const modalType = ref('')
const showModalForm = ref({
  id: null,
  name: '',
  description: ''
})
const showModalDeleteForm = ref({
  id: null,
  name: '',
  description: ''
})

const columns = [
  { name: 'name', label: 'Service Name' },
  { name: 'description', label: 'Description' },
  { name: 'action', label: 'Actions' }
]

async function fetchServices() {
  loading.value = true
  error.value = ''
  try {
    const data = await $fetch('/api/therapyService/list')
    services.value = data.map(item => ({ ...item, action: true }))
  } catch (e) {
    error.value = 'Failed to load services'
  }
  loading.value = false
}

function openModal(value, action) {
  modalType.value = action
  if (action === 'edit' && value) {
    showModalForm.value = { ...value }
  } else {
    showModalForm.value = { id: null, name: '', description: '' }
  }
  showModal.value = true
}

function openModalDelete(value) {
  showModalDeleteForm.value = { ...value }
  showModalDelete.value = true
}

async function saveService() {
  error.value = ''
  try {
    if (modalType.value === 'edit') {
      await $fetch(`/api/therapyService/update?id=${showModalForm.value.id}`, {
        method: 'PUT',
        body: { name: showModalForm.value.name, description: showModalForm.value.description }
      })
    } else {
      await $fetch('/api/therapyService/add', {
        method: 'POST',
        body: { name: showModalForm.value.name, description: showModalForm.value.description }
      })
    }
    showModal.value = false
    await fetchServices()
  } catch (e) {
    error.value = e.data?.message || e.message || 'Failed to save service'
    // Optionally log the error for debugging
    console.error(e)
  }
}

async function deleteService() {
  error.value = ''
  try {
    await $fetch(`/api/therapyService/delete?id=${showModalDeleteForm.value.id}`, { method: 'DELETE' })
    showModalDelete.value = false
    await fetchServices()
  } catch (e) {
    error.value = 'Failed to delete service'
  }
}

onMounted(fetchServices)
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Therapy Services</h1>
    <div class="card p-4 mt-4">
      <div class="flex justify-end items-center mb-4">
        <rs-button @click="openModal(null, 'add')">
          <Icon name="material-symbols:add" class="mr-1"></Icon>
          Add Service
        </rs-button>
      </div>
      <div v-if="error" class="text-red-500 mb-2">{{ error }}</div>
      <rs-table
        :data="services"
        :columns="columns"
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
        <template v-slot:action="data">
          <div class="flex justify-center items-center">
            <Icon
              name="material-symbols:edit-outline-rounded"
              class="text-primary hover:text-primary/90 cursor-pointer mr-1"
              size="22"
              @click="openModal(data.value, 'edit')"
            ></Icon>
            <Icon
              name="material-symbols:close-rounded"
              class="text-primary hover:text-primary/90 cursor-pointer"
              size="22"
              @click="openModalDelete(data.value)"
            ></Icon>
          </div>
        </template>
      </rs-table>
    </div>
  </div>
  <rs-modal
    :title="modalType == 'edit' ? 'Edit Service' : 'Add Service'"
    ok-title="Save"
    :ok-callback="saveService"
    cancel-title="Cancel"
    v-model="showModal"
    :overlay-close="false"
  >
    <div class="grid grid-cols-1 gap-4">
      <FormKit
        type="text"
        v-model="showModalForm.name"
        name="name"
        label="Service Name"
      />
      <FormKit
        type="textarea"
        v-model="showModalForm.description"
        name="description"
        label="Description"
      />
    </div>
  </rs-modal>
  <!-- Modal Delete Confirmation -->
  <rs-modal
    title="Delete Confirmation"
    ok-title="Yes"
    cancel-title="No"
    :ok-callback="deleteService"
    v-model="showModalDelete"
    :overlay-close="false"
  >
    <p>
      Are you sure want to delete this service ({{ showModalDeleteForm.name }})?
    </p>
  </rs-modal>
</template>