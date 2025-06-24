<script setup>
import { ref } from 'vue';

const data = [
  {
    centreName: "Bright Minds Autism Centre",
    address: "123 Main St, Cityville",
    contactNumber: "1234567890",
    email: "info@brightminds.com",
    headOfCentre: "Dr. John Smith",
    action: "edit",
  }
]

const showModal = ref(false);
const showModalDelete = ref(false);
const modalType = ref('');
const showModalForm = ref({
  centreName: '',
  address: '',
  contactNumber: '',
  email: '',
  headOfCentre: '',
});
const showModalDeleteForm = ref({
  centreName: '',
  address: '',
  contactNumber: '',
  email: '',
  headOfCentre: '',
});

const columns = [
  { name: 'centreName', label: 'Centre Name' },
  { name: 'address', label: 'Address' },
  { name: 'contactNumber', label: 'Contact Number' },
  { name: 'email', label: 'Email' },
  { name: 'headOfCentre', label: 'Head of Centre' },
  { name: 'action', label: 'Actions' }
];

function openModal(value, action) {
  modalType.value = action;
  if (action === 'edit' && value) {
    showModalForm.value = { ...value };
  } else {
    showModalForm.value = {
      centreName: '',
      address: '',
      contactNumber: '',
      email: '',
      headOfCentre: '',
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

function saveCentre() {
  // Implement the logic to save centre
  console.log('Save', showModalForm.value);
  showModal.value = false;
}

function deleteCentre() {
  // Implement the logic to delete centre
  console.log('Delete', showModalDeleteForm.value);
  showModalDelete.value = false;
}
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Manage Autism Centre</h1>
    <div class="card p-4 mt-4">
      <div class="flex justify-end items-center mb-4">
        <rs-button @click="openModal(null, 'add')">
          <Icon name="material-symbols:add" class="mr-1"></Icon>
          Add Centre
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
      v-model="showModalForm.centreName"
      name="centreName"
      label="Centre Name"
      :disabled="modalType == 'edit' ? true : false"
    />
    <FormKit
      type="text"
      v-model="showModalForm.address"
      name="address"
      label="Address"
      :disabled="modalType == 'edit' ? true : false"
    />
    <FormKit
      type="number"
      v-model="showModalForm.contactNumber"
      name="contactNumber"
      label="Contact Number"
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
      type="text"
      v-model="showModalForm.headOfCentre"
      name="headOfCentre"
      label="Head of Centre"
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
        showModalDeleteForm.centreName
      }})?
    </p>
  </rs-modal>
</template>