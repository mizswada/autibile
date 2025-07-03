<script setup>
import { ref, onMounted } from 'vue'

const centres = ref([])
const loading = ref(false)
const error = ref('')
const showModal = ref(false)
const showModalDelete = ref(false)
const modalType = ref('')
const showModalForm = ref({
  id: null,
  center_name: '',
  center_address: '',
  center_phone: '',
  center_location: ''
})
const showModalDeleteForm = ref({
  id: null,
  center_name: '',
  center_phone: '',
  center_address: '',
})

const columns = [
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
    centres.value = Array.isArray(res) ? res : (res.data ? [res.data] : [])
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
      center_location: ''
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
  try {
    if (modalType.value === 'edit') {
      await $fetch(`/api/autismCentre/update?id=${showModalForm.value.id}`, {
        method: 'PUT',
        body: {
          center_name: showModalForm.value.center_name,
          center_address: showModalForm.value.center_address,
          center_phone: showModalForm.value.center_phone,
          center_location: showModalForm.value.center_location
        }
      })
    } else {
      await $fetch('/api/autismCentre/add', {
        method: 'POST',
        body: {
          center_name: showModalForm.value.center_name,
          center_address: showModalForm.value.center_address,
          center_phone: showModalForm.value.center_phone,
          center_location: showModalForm.value.center_location
        }
      })
    }
    showModal.value = false
    await fetchCentres()
  } catch (e) {
    error.value = e.data?.message || e.message || 'Failed to save centre'
    console.error(e)
  }
}

async function deleteCentre() {
  error.value = ''
  try {
    await $fetch(`/api/autismCentre/delete?id=${showModalDeleteForm.value.id}`, { method: 'DELETE' })
    showModalDelete.value = false
    await fetchCentres()
  } catch (e) {
    error.value = 'Failed to delete centre'
  }
}

onMounted(fetchCentres)
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Manage Therapy Centre</h1>
    <div class="card p-4 mt-4">
      <div class="flex justify-end items-center mb-4">
        <rs-button @click="openModal(null, 'add')">
          <Icon name="material-symbols:add" class="mr-1"></Icon>
          Add Centre
        </rs-button>
      </div>
      <rs-table
        :data="centres"
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
      label="Centre Name"
      :disabled="modalType == 'edit' ? true : false"
    />
    <FormKit
      type="text"
      v-model="showModalForm.center_address"
      name="address"
      label="Address"
      :disabled="modalType == 'edit' ? true : false"
    />
    <FormKit
      type="number"
      v-model="showModalForm.center_phone"
      name="contactNumber"
      label="Contact Number"
      :disabled="modalType == 'edit' ? true : false"
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
</template>