<script setup>
import { ref, onMounted } from 'vue'

const centres = ref([])
const loading = ref(false)
const error = ref('')
const success = ref('') // Add success message state
const showModal = ref(false)
const showModalDelete = ref(false)
const modalType = ref('')
const showModalForm = ref({
  id: null,
  center_name: '',
  center_address: '',
  center_phone: '',
  center_location: '',
  center_logo: '' // Add missing field
})
const showModalDeleteForm = ref({
  id: null,
  center_name: '',
  center_phone: '',
  center_address: '',
})

const columns = [
  { name: 'id', label: 'Centre ID' },
  { name: 'center_name', label: 'Centre Name' },
  { name: 'center_address', label: 'Address' },
  { name: 'center_phone', label: 'Contact Number' },
  { name: 'action', label: 'Actions' }
]

async function fetchCentres() {
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch('/api/autismCentre/list')
    centres.value = Array.isArray(res) ? res : []
  } catch (e) {
    error.value = 'Failed to load centres'
  }
  loading.value = false
}

function openModal(value, action) {
  modalType.value = action
  if (action === 'edit' && value) {
    showModalForm.value = { ...value }
  } else {
    showModalForm.value = {
      id: null,
      center_name: '',
      center_address: '',
      center_phone: '',
      center_location: '',
      center_logo: ''
    }
  }
  showModal.value = true
}

function openModalDelete(value) {
  showModalDeleteForm.value = { ...value }
  showModalDelete.value = true
}

async function saveCentre() {
  error.value = ''
  success.value = '' // Clear previous success message
  
  // Validate required fields
  if (!showModalForm.value.center_name || !showModalForm.value.center_address || 
      !showModalForm.value.center_phone || !showModalForm.value.center_location) {
    error.value = 'Please fill in all required fields'
    return
  }
  
  try {
    if (modalType.value === 'edit') {
      const res = await $fetch(`/api/autismCentre/update?id=${showModalForm.value.id}`, {
        method: 'PUT',
        body: {
          center_name: showModalForm.value.center_name,
          center_address: showModalForm.value.center_address,
          center_phone: showModalForm.value.center_phone.toString(), // Convert to string
          center_location: showModalForm.value.center_location,
          center_logo: showModalForm.value.center_logo || ''
        }
      })
      
      if (res.statusCode === 200) {
        success.value = 'Centre updated successfully!'
        showModal.value = false
        await fetchCentres()
        // Clear success message after 3 seconds
        setTimeout(() => {
          success.value = ''
        }, 3000)
      } else {
        error.value = res.message || 'Failed to update centre'
      }
    } else {
      const res = await $fetch('/api/autismCentre/add', {
        method: 'POST',
        body: {
          center_name: showModalForm.value.center_name,
          center_address: showModalForm.value.center_address,
          center_phone: showModalForm.value.center_phone.toString(), // Convert to string
          center_location: showModalForm.value.center_location,
          center_logo: showModalForm.value.center_logo || ''
        }
      })
      
      if (res.statusCode === 200) {
        success.value = 'Centre created successfully!'
        showModal.value = false
        await fetchCentres()
        // Clear success message after 3 seconds
        setTimeout(() => {
          success.value = ''
        }, 3000)
      } else {
        error.value = res.message || 'Failed to create centre'
      }
    }
  } catch (e) {
    error.value = e.data?.message || e.message || 'Failed to save centre'
    console.error(e)
  }
}

async function deleteCentre() {
  error.value = ''
  success.value = '' // Clear previous success message
  try {
    await $fetch(`/api/autismCentre/delete?id=${showModalDeleteForm.value.id}`, { method: 'DELETE' })
    success.value = 'Centre deleted successfully!'
    showModalDelete.value = false
    await fetchCentres()
    // Clear success message after 3 seconds
    setTimeout(() => {
      success.value = ''
    }, 3000)
  } catch (e) {
    error.value = 'Failed to delete centre'
  }
}

onMounted(fetchCentres)
</script>

<template>
  <div>
    <div class="mb-4">
      <h1 class="text-2xl font-bold">Manage Therapy Centre</h1>
      <div class="card p-4 mt-4">
        <!-- Error Display -->
        <div v-if="error" class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {{ error }}
        </div>
        
        <!-- Success Display -->
        <div v-if="success" class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          {{ success }}
        </div>
        
        <div class="flex justify-end items-center mb-4">
          <rs-button @click="openModal(null, 'add')">
            <Icon name="material-symbols:add" class="mr-1"></Icon>
            Add Centre
          </rs-button>
        </div>
        <rs-table
          :data="centres"
          :field="['no', 'centreName', 'address', 'contactNumber', 'location', 'action']"
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
          <template v-slot:centreName="data">
            {{ data.value.center_name }}
          </template>
          <template v-slot:address="data">
            {{ data.value.center_address }}
          </template>
          <template v-slot:contactNumber="data">
            {{ data.value.center_phone }}
          </template>
          <template v-slot:location="data">
            <a :href="data.value.center_location" target="_blank">  
              {{ data.value.center_location }}
            </a>
          </template>
          <template v-slot:action="data" class="flex justify-center items-center">
            <div class="flex justify-center items-center">
              <Icon
                name="material-symbols:edit-outline-rounded"
                class="text-primary hover:text-primary/90 cursor-pointer mr-3"
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
      :title="modalType == 'edit' ? 'Edit Centre' : 'Add Centre'"
      ok-title="Save"
      :ok-callback="saveCentre"
      cancel-title="Cancel"
      v-model="showModal"
      :overlay-close="false"
    >
      <FormKit
        type="text"
        v-model="showModalForm.center_name"
        name="centreName"
        label="Centre Name *"
        validation="required"
      />
      <FormKit
        type="textarea"
        v-model="showModalForm.center_address"
        name="address"
        label="Address *"
        validation="required"
      />
      <FormKit
        type="text"
        v-model="showModalForm.center_location"
        name="location"
        label="Location *"
        validation="required"
      />
      <FormKit
        type="text"
        v-model="showModalForm.center_phone"
        name="contactNumber"
        label="Contact Number *"
        validation="required"
        placeholder="e.g., +60123456789"
      />
      <FormKit
        type="text"
        v-model="showModalForm.center_logo"
        name="logo"
        label="Logo URL"
        placeholder="https://example.com/logo.png"
      />
    </rs-modal>
    <!-- Modal Delete Confirmation -->
    <rs-modal
      title="Delete Confirmation"
      ok-title="Yes"
      cancel-title="No"
      :ok-callback="deleteCentre"
      v-model="showModalDelete"
      :overlay-close="false"
    >
      <p>
        Are you sure want to delete this centre ({{
          showModalDeleteForm.center_name
        }})?
      </p>
    </rs-modal>
  </div>
</template>