<script setup>
import { ref } from 'vue';

const practitioners = ref([
  {
    id: 1,
    name: "Dr. Alice Lee",
    type: "Doctor",
    registrationNo: "DOC12345",
    specialty: "Pediatrics",
    department: "Child Health",
    qualification: "MBBS, MRCP",
    experience: "10 years",
    signature: "",
    action: "edit",
  }
]);

const showModal = ref(false);
const isEdit = ref(false);
const editId = ref(null);
const form = ref({
  name: '',
  type: '',
  registrationNo: '',
  specialty: '',
  department: '',
  qualification: '',
  experience: '',
  signature: '',
});

function openAddModal() {
  form.value = {
    name: '',
    type: '',
    registrationNo: '',
    specialty: '',
    department: '',
    qualification: '',
    experience: '',
    signature: '',
  };
  isEdit.value = false;
  editId.value = null;
  showModal.value = true;
}

function openEditModal(practitioner) {
  form.value = { ...practitioner };
  isEdit.value = true;
  editId.value = practitioner.id;
  showModal.value = true;
}

function savePractitioner() {
  if (form.value.name && form.value.type && form.value.registrationNo) {
    if (isEdit.value && editId.value !== null) {
      const idx = practitioners.value.findIndex(p => p.id === editId.value);
      if (idx !== -1) {
        practitioners.value[idx] = { ...practitioners.value[idx], ...form.value };
      }
    } else {
      practitioners.value.push({
        id: Date.now(),
        ...form.value,
      });
    }
    showModal.value = false;
  }
}

function deletePractitioner(id) {
  practitioners.value = practitioners.value.filter(p => p.id !== id);
}
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Practitioner Management</h1>
    <div class="flex justify-end mb-2">
      <rs-button @click="openAddModal">
        <Icon name="material-symbols:add" class="mr-1" />
        Add Practitioner
      </rs-button>
    </div>
    <div class="card p-4 mt-4">
      <rs-table
        :data="practitioners"
        :columns="[
          { name: 'name', label: 'Name' },
          { name: 'type', label: 'Type' },
          { name: 'registrationNo', label: 'Registration No' },
          { name: 'specialty', label: 'Specialty' },
          { name: 'department', label: 'Department' },
          { name: 'qualification', label: 'Qualification' },
          { name: 'experience', label: 'Experience' },
          { name: 'signature', label: 'Signature' },
          { name: 'action', label: 'Actions', slot: true }
        ]"
        :options="{ borderless: true }"
        advanced
      >
        <template #action="slotProps">
          <div class="flex gap-2">
            <rs-button size="sm" @click="openEditModal(slotProps.row)">
              <Icon name="material-symbols:edit-outline-rounded" />
            </rs-button>
            <rs-button
              size="sm"
              variant="danger"
              @click="deletePractitioner(slotProps.row.id)"
            >
              <Icon name="material-symbols:delete-outline" />
            </rs-button>
          </div>
        </template>
      </rs-table>
    </div>
    <rs-modal
      :title="isEdit ? 'Edit Practitioner' : 'Add Practitioner'"
      ok-title="Save"
      cancel-title="Cancel"
      :ok-callback="savePractitioner"
      v-model="showModal"
      :overlay-close="false"
    >
      <div class="grid grid-cols-2 gap-4">
        <FormKit
          type="text"
          v-model="form.name"
          name="name"
          label="Name"
        />
        <FormKit
          type="select"
          v-model="form.type"
          name="type"
          label="Practitioner Type"
          :options="[
            { label: 'Doctor', value: 'Doctor' },
            { label: 'Therapist', value: 'Therapist' }
          ]"
        />
        <FormKit
          type="text"
          v-model="form.registrationNo"
          name="registrationNo"
          label="Registration No"
        />
        <FormKit
          type="text"
          v-model="form.specialty"
          name="specialty"
          label="Specialty"
        />
        <FormKit
          type="text"
          v-model="form.department"
          name="department"
          label="Department"
        />
        <FormKit
          type="text"
          v-model="form.qualification"
          name="qualification"
          label="Qualification"
        />
        <FormKit
          type="text"
          v-model="form.experience"
          name="experience"
          label="Experience"
          placeholder="e.g. 5 years"
        />
        <FormKit
          type="file"
          v-model="form.signature"
          name="signature"
          label="Signature"
          accept="image/*"
        />
      </div>
    </rs-modal>
  </div>
</template>
