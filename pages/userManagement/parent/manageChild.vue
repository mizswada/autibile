<script setup>
import { ref } from 'vue';

const data = [
  {
    "childId": "C001",
    "childName": "Jane Doe",
    "parentName": "John Doe",
    "phoneNumber": "1234567890",
    "childId": "C001",
    "gender": "Female",
    "dob": "2019-01-01",
    "autismCategory": "Mild",
    "totalSession": 10,
    "action": "edit",
  }
]

const showModal = ref(false);
const showModalDelete = ref(false);
const modalType = ref('');
const showModalForm = ref({
  childId: '',
  childName: '',
  parentName: '',
  phoneNumber: '',
  gender: '',
  dob: '',
  autismCategory: '',
  totalSession: '',
});
const showModalDeleteForm = ref({
  parentName: '',
  phoneNumber: '',
  childName: '',
  childId: '',
  gender: '',
  dob: '',
  autismCategory: '',
  totalSession: '',
});

const columns = [
  { name: 'childname', label: 'Child Name' },
  { name: 'childid', label: 'Child ID' },
  { name: 'parentname', label: 'Parent Name' },
  { name: 'phonenumber', label: 'Phone Number' },
  { name: 'gender', label: 'Gender' },
  { name: 'dob', label: 'Date of Birth' },
  { name: 'autismcategory', label: 'Autism Category' },
  { name: 'totalsession', label: 'Total Session' },
  { name: 'action', label: 'Actions' }
];

function openModal(value, action) {
  modalType.value = action;
  if (action === 'edit' && value) {
    showModalForm.value = { ...value };
  } else {
    showModalForm.value = {
      childName: '',
      childId: '',
      parentName: '',
      phoneNumber: '',
      gender: '',
      dob: '',
      autismCategory: '',
      totalSession: '',
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
    <h1 class="text-2xl font-bold">Manage Child</h1>
    <div class="card p-4 mt-4">
      <div class="flex justify-end items-center mb-4">
        <rs-button @click="openModal(null, 'add')">
          <Icon name="material-symbols:add" class="mr-1"></Icon>
          Add Child
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
    :title="modalType == 'edit' ? 'Edit Child' : 'Add Child'"
    ok-title="Save"
    :ok-callback="saveParent"
    cancel-title="Cancel"
    v-model="showModal"
    :overlay-close="false"
  >
    <div class="grid grid-cols-2 gap-4">
      <FormKit
        type="text"
        v-model="showModalForm.childName"
        name="childName"
        label="Child Name"
        :disabled="modalType == 'edit' ? true : false"
      />
      <FormKit
        type="text"
        v-model="showModalForm.childId"
        name="childId"
        label="Child ID"
        :disabled="modalType == 'edit' ? true : false"
      />
      <FormKit
        type="select"
        v-model="showModalForm.parentName"
        name="parentName"
        label="Parent Name"
        :options="[
          { label: 'John Doe', value: 'John Doe' },
          { label: 'Jane Smith', value: 'Jane Smith' },
          { label: 'Michael Lee', value: 'Michael Lee' }
        ]"
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
        type="select"
        v-model="showModalForm.gender"
        name="gender"
        label="Gender"
        :options="[
          { label: 'Male', value: 'Male' },
          { label: 'Female', value: 'Female' },
          { label: 'Other', value: 'Other' }
        ]"
        :disabled="modalType == 'edit' ? true : false"
      />
      <FormKit
        type="date"
        v-model="showModalForm.dob"
        name="dob"
        label="Date of Birth"
        :disabled="modalType == 'edit' ? true : false"
      />
      <FormKit
        type="select"
        v-model="showModalForm.autismCategory"
        name="autismCategory"
        label="Autism Category"
        :options="[
          { label: 'Mild', value: 'Mild' },
          { label: 'Minor', value: 'Minor' },
          { label: 'Major', value: 'Major' }
        ]"
        :disabled="modalType == 'edit' ? true : false"
      />
      <FormKit
        type="number"
        v-model="showModalForm.totalSession"
        name="totalSession"
        label="Total Session"
        :disabled="modalType == 'edit' ? true : false"
      />
    </div>
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
      Are you sure want to delete this child ({{
        showModalDeleteForm.childName
      }})?
    </p>
  </rs-modal>
</template>