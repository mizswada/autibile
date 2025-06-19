 <script setup>
import { ref } from 'vue';

const data = [
  {
    "parentName": "John Doe",
    "email": "Johndoe@gmail.com",
    "phoneNumber": "1234567890",
    "childName": "Jane Doe",
    "childAge": 5,
    "action": "edit",
  }
]

const showModal = ref(false);
const showModalDelete = ref(false);
const modalType = ref('');
const showModalForm = ref({
  parentName: '',
  email: '',
  phoneNumber: '',
  childName: '',
  childAge: '',
});
const showModalDeleteForm = ref({
  parentName: '',
  email: '',
  phoneNumber: '',
  childName: '',
  childAge: '',
});

const columns = [
  { name: 'parentname', label: 'Full Name' },
  { name: 'email', label: 'Email' },
  { name: 'phonenumber', label: 'Phone Number' },
  { name: 'childname', label: 'Child Name' },
  { name: 'childage', label: 'Child Age' },
  { name: 'action', label: 'Actions' }
];

function openModal(value, action) {
  modalType.value = action;
  if (action === 'edit' && value) {
    showModalForm.value = { ...value };
  } else {
    showModalForm.value = {
      parentName: '',
      email: '',
      phoneNumber: '',
      childName: '',
      childAge: '',
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

function saveParent() {
  // Implement the logic to save user
  console.log('Save', showModalForm.value);
  showModal.value = false;
}

function deleteParent() {
  // Implement the logic to delete user
  console.log('Delete', showModalDeleteForm.value);
  showModalDelete.value = false;
}
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Parents</h1>
    <div class="card p-4 mt-4">
      <div class="flex justify-end items-center mb-4">
        <rs-button @click="openModal(null, 'add')">
          <Icon name="material-symbols:add" class="mr-1"></Icon>
          Add Parent
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
    :title="modalType == 'edit' ? 'Edit Parent' : 'Add Parent'"
    ok-title="Save"
    :ok-callback="saveParent"
    cancel-title="Cancel"
    v-model="showModal"
    :overlay-close="false"
  >
    <FormKit
      type="text"
      v-model="showModalForm.parentName"
      name="parentName"
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
      v-model="showModalForm.childName"
      name="childName"
      label="Child Name"
      :disabled="modalType == 'edit' ? true : false"
    />
    <FormKit
      type="number"
      v-model="showModalForm.childAge"
      name="childAge"
      label="Child Age"
      :disabled="modalType == 'edit' ? true : false"
    />
  </rs-modal>
  <!-- Modal Delete Confirmation -->
  <rs-modal
    title="Delete Confirmation"
    ok-title="Yes"
    cancel-title="No"
    :ok-callback="deleteParent"
    v-model="showModalDelete"
    :overlay-close="false"
  >
    <p>
      Are you sure want to delete this user ({{
        showModalDeleteForm.parentName
      }})?
    </p>
  </rs-modal>
</template>