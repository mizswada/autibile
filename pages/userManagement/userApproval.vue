<script setup>
import { ref } from 'vue';

const data = [
  {
    "fullName": "Dr. John Smith",
    "email": "drjohnsmith@gmail.com",
    "phoneNumber": "1234567890",
    "role": "Doctor",
    "specialization": "Pediatrics",
    "experience": 10,
    "action": "edit",
  },
  {
    "fullName": "Jane Doe",
    "email": "janedoe@gmail.com",
    "phoneNumber": "9876543210",
    "role": "Therapist",
    "specialization": "Speech Therapy",
    "experience": 5,
    "action": "edit",
  }
]

const showModal = ref(false);
const showModalDelete = ref(false);
const showApproveConfirm = ref(false);
const modalType = ref('');
const showModalForm = ref({
  fullName: '',
  email: '',
  phoneNumber: '',
  role: '',
  specialization: '',
  experience: '',
});
const showModalDeleteForm = ref({
  fullName: '',
  email: '',
  phoneNumber: '',
  role: '',
  specialization: '',
  experience: '',
});

const columns = [
  { name: 'fullname', label: 'Full Name' },
  { name: 'email', label: 'Email' },
  { name: 'phonenumber', label: 'Phone Number' },
  { name: 'role', label: 'Role' },
  { name: 'specialization', label: 'Specialization' },
  { name: 'experience', label: 'Experience (years)' },
  { name: 'action', label: 'Actions' }
];

function openModal(value, action) {
  modalType.value = action;
  if (action === 'approve' && value) {
    showModalForm.value = { ...value };
    showApproveConfirm.value = true;
  } else if (action === 'edit' && value) {
    showModalForm.value = { ...value };
    showModal.value = true;
  } else {
    showModalForm.value = {
      fullName: '',
      email: '',
      phoneNumber: '',
      role: '',
      specialization: '',
      experience: '',
    };
    showModal.value = true;
  }
}

function openModalDelete(value) {
  showModalDeleteForm.value = { ...value };
  showModalDelete.value = true;
}

function openModalAdd() {
  openModal(null, 'add');
}

function approveUser() {
  // Implement the logic to approve user
  console.log('Approve', showModalForm.value);
  showModal.value = false;
}

function confirmApproveUser() {
  showApproveConfirm.value = false;
  showModal.value = true;
}

function rejectUser() {
  // Implement the logic to reject user
  console.log('Reject', showModalDeleteForm.value);
  showModalDelete.value = false;
}
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">User Approval (Doctor & Therapist)</h1>
    <div class="card p-4 mt-4">
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
          <div class="flex justify-center items-center">
            <rs-button size="sm" class="mr-2" @click="openModal(data.value, 'approve')">
              Approve
            </rs-button>
            <rs-button size="sm" variant="danger" @click="openModalDelete(data.value)">
              Reject
            </rs-button>
          </div>
        </template>
      </rs-table>
    </div>
  </div>
  <!-- Approve Confirmation Modal -->
  <rs-modal
    title="Approve Confirmation"
    ok-title="Yes"
    cancel-title="No"
    :ok-callback="confirmApproveUser"
    v-model="showApproveConfirm"
    :overlay-close="false"
  >
    <p>
      Do you want to approve this user ({{ showModalForm.fullName }})?
    </p>
  </rs-modal>
  <rs-modal
    :title="'Approve User (' + (showModalForm.role || '') + ')'" 
    ok-title="Approve"
    :ok-callback="approveUser"
    cancel-title="Cancel"
    v-model="showModal"
    :overlay-close="false"
  >
    <FormKit
      type="text"
      v-model="showModalForm.fullName"
      name="fullName"
      label="Full Name"
      :disabled="true"
    />
    <FormKit
      type="email"
      v-model="showModalForm.email"
      name="email"
      label="Email"
      :disabled="true"
    />
    <FormKit
      type="number"
      v-model="showModalForm.phoneNumber"
      name="phoneNumber"
      label="Phone Number"
      :disabled="true"
    />
    <FormKit
      type="text"
      v-model="showModalForm.role"
      name="role"
      label="Role"
      :disabled="true"
    />
    <FormKit
      type="text"
      v-model="showModalForm.specialization"
      name="specialization"
      label="Specialization"
      :disabled="true"
    />
    <FormKit
      type="number"
      v-model="showModalForm.experience"
      name="experience"
      label="Experience (years)"
      :disabled="true"
    />
  </rs-modal>
  <!-- Modal Reject Confirmation -->
  <rs-modal
    title="Reject Confirmation"
    ok-title="Yes"
    cancel-title="No"
    :ok-callback="rejectUser"
    v-model="showModalDelete"
    :overlay-close="false"
  >
    <p>
      Are you sure want to reject this user ({{ showModalDeleteForm.fullName }})?
    </p>
  </rs-modal>
</template>