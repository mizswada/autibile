<script setup>
import { ref } from 'vue';

// Therapy Plans data
const therapyPlans = ref([
  {
    id: 1,
    serviceId: '001',
    therapyTitle: 'Speech Therapy',
    therapyDescription: 'Helps improve communication skills.',
    status: true,
    action: 'Edit/Delete'
  },
  {
    id: 2,
    serviceId: '002',
    therapyTitle: 'Occupational Therapy',
    therapyDescription: 'Supports daily living activities.',
    status: false,
    action: 'Edit/Delete'
  }
]);

// Form state
const form = ref({
  id: null,
  serviceId: '',
  therapyTitle: '',
  therapyDescription: '',
  status: true
});
const isEdit = ref(false);

// Form actions
function resetForm() {
  form.value = {
    id: null,
    serviceId: '',
    therapyTitle: '',
    therapyDescription: '',
    status: true
  };
  isEdit.value = false;
}

function submitForm() {
  if (isEdit.value) {
    const idx = therapyPlans.value.findIndex(p => p.id === form.value.id);
    if (idx !== -1) therapyPlans.value[idx] = { ...form.value };
  } else {
    therapyPlans.value.push({
      ...form.value,
      id: Date.now()
    });
  }
  resetForm();
}

function editPlan(plan) {
  form.value = { ...plan };
  isEdit.value = true;
}

function deletePlan(id) {
  therapyPlans.value = therapyPlans.value.filter(p => p.id !== id);
  if (form.value.id === id) resetForm();
}
</script>
<template>
  <div class="max-w-2xl mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">Therapy Plan Management</h1>
    <div class="card p-4 mb-6">
      <h2 class="text-xl font-semibold mb-2">{{ isEdit ? 'Update' : 'Add' }} Therapy Plan</h2>
      <form @submit.prevent="submitForm">
        <div class="mb-3">
          <FormKit type="text" v-model="form.serviceId" name="serviceId" label="Service ID" required />
        </div>
        <div class="mb-3">
          <FormKit type="text" v-model="form.therapyTitle" name="therapyTitle" label="Therapy Title" required />
        </div>
        <div class="mb-3">
          <FormKit type="textarea" v-model="form.therapyDescription" name="therapyDescription" label="Therapy Description" required />
        </div>
        <div class="mb-3">
          <FormKit
            type="switch"
            v-model="form.status"
            name="status"
            label="Status"
            :options="[{ value: true, label: 'Enabled' }, { value: false, label: 'Disabled' }]"
          />
        </div>
        <div class="flex gap-2 justify-end">
          <rs-button type="submit" variant="primary">{{ isEdit ? 'Update' : 'Add' }}</rs-button>
          <rs-button type="button" variant="secondary" @click="resetForm" v-if="isEdit">Cancel</rs-button>
        </div>
      </form>
    </div>
    <div class="card p-4">
      <h2 class="text-xl font-semibold mb-2">Registered Therapy Plans</h2>
      <rs-table
        :data="therapyPlans"
        :columns="
          [
            { name: 'serviceId', label: 'Service ID' },
            { name: 'therapyTitle', label: 'Therapy Title' },
            { name: 'therapyDescription', label: 'Therapy Description' },
            { name: 'status', label: 'Status', slot: true },
            { name: 'action', label: 'Actions', slot: true }
          ]
        "
        :options="{ borderless: true }"
        advanced
      >
        <template #status="slotProps">
          <span :class="slotProps.row.status ? 'text-green-600' : 'text-gray-400'">
            {{ slotProps.row.status ? 'Enabled' : 'Disabled' }}
          </span>
        </template>
        <template #action="slotProps">
          <div class="flex gap-2">
            <rs-button size="sm" @click="editPlan(slotProps.row)">
              <Icon name="material-symbols:edit-outline-rounded" />
            </rs-button>
            <rs-button size="sm" variant="danger" @click="deletePlan(slotProps.row.id)">
              <Icon name="material-symbols:delete-outline" />
            </rs-button>
          </div>
        </template>
      </rs-table>
    </div>
  </div>
</template>