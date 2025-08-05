<script setup>
import { ref, onMounted, watch } from 'vue'

const services = ref([])
const therapyCenters = ref([])
const loading = ref(false)
const error = ref('')
const success = ref('')
const showModal = ref(false)
const showModalDelete = ref(false)
const modalType = ref('')
const showModalForm = ref({
  id: null,
  name: '',
  description: '',
  therapy_centerID: null
})
const showModalDeleteForm = ref({
  id: null,
  name: '',
  description: ''
})

// Watch for changes in the form data
watch(showModalForm, (newVal) => {
  console.log('Form data changed:', newVal)
}, { deep: true })

const columns = [
  { name: 'name', label: 'Service Name' },
  { name: 'description', label: 'Description' },
  { name: 'center_name', label: 'Therapy Center' },
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

async function fetchTherapyCenters() {
  try {
    const data = await $fetch('/api/autismCentre/list')
    therapyCenters.value = data
  } catch (e) {
    console.error('Failed to load therapy centers:', e)
  }
}

async function openModal(value, action) {
  modalType.value = action
  if (action === 'edit' && value) {
    // For editing, we need to fetch the full service data to get therapy_centerID
    try {
      const response = await $fetch(`/api/therapyService/get?id=${value.id}`)
      const serviceData = response.data
      console.log('Editing service:', serviceData)
      showModalForm.value = { 
        ...serviceData,
        therapy_centerID: serviceData.therapy_centerID || null
      }
      console.log('Form data:', showModalForm.value)
    } catch (e) {
      console.error('Failed to fetch service data:', e)
      // Fallback to the table data
      showModalForm.value = { 
        ...value,
        therapy_centerID: null
      }
    }
  } else {
    showModalForm.value = { id: null, name: '', description: '', therapy_centerID: null }
  }
  showModal.value = true
}

function openModalDelete(value) {
  showModalDeleteForm.value = { ...value }
  showModalDelete.value = true
}

async function saveService() {
  error.value = ''
  success.value = ''
  
  try {
    if (modalType.value === 'edit') {
      const requestBody = { 
        name: showModalForm.value.name, 
        description: showModalForm.value.description,
        therapy_centerID: showModalForm.value.therapy_centerID || null
      }
      
      const response = await $fetch(`/api/therapyService/update?id=${showModalForm.value.id}`, {
        method: 'PUT',
        body: requestBody
      })
      
      if (response.statusCode === 200) {
        success.value = 'Service updated successfully!'
        showModal.value = false
        await fetchServices()
        clearMessages()
      } else {
        error.value = response.message || 'Failed to update service'
        clearMessages()
      }
    } else {
      const requestBody = { 
        name: showModalForm.value.name, 
        description: showModalForm.value.description,
        therapy_centerID: showModalForm.value.therapy_centerID || null
      }
      
      const response = await $fetch('/api/therapyService/add', {
        method: 'POST',
        body: requestBody
      })
      
      if (response.statusCode === 200) {
        success.value = 'Service added successfully!'
        showModal.value = false
        await fetchServices()
        clearMessages()
      } else {
        error.value = response.message || 'Failed to add service'
        clearMessages()
      }
    }
  } catch (e) {
    error.value = e.data?.message || e.message || 'Failed to save service'
    console.error(e)
    clearMessages()
  }
}

async function deleteService() {
  error.value = ''
  success.value = ''
  
  try {
    const response = await $fetch(`/api/therapyService/delete?id=${showModalDeleteForm.value.id}`, { 
      method: 'DELETE' 
    })
    
    if (response.statusCode === 200) {
      success.value = 'Service deleted successfully!'
      showModalDelete.value = false
      await fetchServices()
      clearMessages()
    } else {
      error.value = response.message || 'Failed to delete service'
      clearMessages()
    }
  } catch (e) {
    error.value = 'Failed to delete service'
    console.error(e)
    clearMessages()
  }
}

// Clear messages after a few seconds
function clearMessages() {
  setTimeout(() => {
    error.value = ''
    success.value = ''
  }, 5000)
}

onMounted(async () => {
  await Promise.all([fetchServices(), fetchTherapyCenters()])
})
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
      
      <!-- Success Message -->
      <div v-if="success" class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
        {{ success }}
      </div>
      
      <!-- Error Message -->
      <div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        {{ error }}
      </div>
      
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
      <FormKit
        type="select"
        v-model="showModalForm.therapy_centerID"
        name="therapy_centerID"
        label="Therapy Center"
        :options="therapyCenters.map(center => ({
          label: center.center_name,
          value: center.center_ID
        }))"
        placeholder="Select a therapy center"
        @update:model-value="(value) => { console.log('Dropdown value changed:', value); showModalForm.therapy_centerID = value }"
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