<script setup>
import { ref } from 'vue';

const data = [
  {
    "fullName": "Dr. John Smith",
    "email": "drjohnsmith@gmail.com",
    "phoneNumber": "1234567890",
    "specialization": "Pediatrics",
    "experience": 10,
    "action": "edit",
  }
]

const showModal = ref(false);
const showModalDelete = ref(false);
const modalType = ref('');
const showModalForm = ref({
  fullName: '',
  email: '',
  phoneNumber: '',
  specialization: '',
  experience: '',
  file: null,
});
const showModalDeleteForm = ref({
  fullName: '',
  email: '',
  phoneNumber: '',
  specialization: '',
  experience: '',
});

const columns = [
  { name: 'fullname', label: 'Full Name' },
  { name: 'email', label: 'Email' },
  { name: 'phonenumber', label: 'Phone Number' },
  { name: 'specialization', label: 'Specialization' },
  { name: 'experience', label: 'Experience (years)' },
  { name: 'action', label: 'Actions' }
];

function openModal(value, action) {
  modalType.value = action;
  if (action === 'edit' && value) {
    showModalForm.value = { ...value, file: null };
  } else {
    showModalForm.value = {
      fullName: '',
      email: '',
      phoneNumber: '',
      specialization: '',
      experience: '',
      file: null,
    };
  }
  showModal.value = true;
}

function openModalDelete(value) {
  showModalDeleteForm.value = { ...value };
  showModalDelete.value = true;
}

function openModalAdd() {
  openModal(null, 'add');
}

function saveDoctor() {
  // Implement the logic to save doctor
  console.log('Save', showModalForm.value);
  showModal.value = false;
}

function deleteDoctor() {
  // Implement the logic to delete doctor
  console.log('Delete', showModalDeleteForm.value);
  showModalDelete.value = false;
}
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Doctors</h1>
    <div class="card p-4 mt-4">
      <div class="flex justify-end items-center mb-4">
        <rs-button @click="openModal(null, 'add')">
          <Icon name="material-symbols:add" class="mr-1"></Icon>
          Add Doctor
        </rs-button>
      </div>
      <rs-table
        :data="data"
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
          <div
            class="flex justify-center items-center"
          >
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
    :title="modalType == 'edit' ? 'Edit Doctor' : 'Add Doctor'"
    ok-title="Save"
    :ok-callback="saveDoctor"
    cancel-title="Cancel"
    v-model="showModal"
    :overlay-close="false"
  >
    <FormKit
      type="text"
      v-model="showModalForm.fullName"
      name="fullName"
      label="Full Name"
      :disabled="modalType == 'edit' ? true : false"
    />
    <FormKit
      type="email"
      v-model="showModalForm.email"
      name="email"
      label="Email"
      :disabled="modalType == 'edit' ? true : false"
    />
     <FormKit
      type="number"
      v-model="showModalForm.phoneNumber"
      name="phoneNumber"
      label="Phone Number"
      :disabled="modalType == 'edit' ? true : false"
    />
    <FormKit
      type="text"
      v-model="showModalForm.specialization"
      name="specialization"
      label="Specialization"
      :disabled="modalType == 'edit' ? true : false"
    />
    <FormKit
      type="number"
      v-model="showModalForm.experience"
      name="experience"
      label="Experience (years)"
      :disabled="modalType == 'edit' ? true : false"
    />

    <FormKit
                  type="file"
                  label="Upload Pictures"
                  accept=".jpeg, .gif, .png, .tiff, .bmp, and .pdf"
                />
  </rs-modal>
  <!-- Modal Delete Confirmation -->
  <rs-modal
    title="Delete Confirmation"
    ok-title="Yes"
    cancel-title="No"
    :ok-callback="deleteDoctor"
    v-model="showModalDelete"
    :overlay-close="false"
  >
    <p>
      Are you sure want to delete this doctor ({{
        showModalDeleteForm.fullName
      }})?
    </p>
  </rs-modal>
</template>