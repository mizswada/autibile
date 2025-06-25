<!-- Added by: Firzana Huda 24 June 2025 -->
<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();

const relationshipOptions = ref([]);
const nationalityOptions = ref([]);
const stateOptions = ref([]);

const form = ref({
  relationship: null,
  gender: '',
  dateOfBirth: '',
  nationality: null,
  phone: '',
  numberOfChildren: 1,
  childrenNames: [''],
  city: '',
  postcode: '',
  state: null,
  status: '',
});

watch(() => form.value.numberOfChildren, (newCount) => {
  const count = parseInt(newCount) || 0;
  const current = form.value.childrenNames.length;
  if (count > current) {
    for (let i = current; i < count; i++) {
      form.value.childrenNames.push('');
    }
  } else if (count < current) {
    form.value.childrenNames.splice(count);
  }
});

onMounted(async () => {
  const parentID = route.query.parentID;
  if (!parentID) {
    alert("Missing parent ID");
    router.push('/userManagement/parent/parents');
    return;
  }

  try {
    const [relRes, natRes, stateRes, parentRes] = await Promise.all([
      fetch('/api/parents/lookupRelationship'),
      fetch('/api/parents/lookupNationality'),
      fetch('/api/parents/lookupState'),
      fetch(`/api/parents/fetchEdit?parentID=${parentID}`),

    ]);

    const relData = await relRes.json();
    const natData = await natRes.json();
    const stateData = await stateRes.json();
    const parentData = await parentRes.json();

    if (parentData.statusCode !== 200) {
      alert('Parent not found.');
      router.push('/userManagement/parent/parents');
      return;
    }

    form.value = { ...parentData.data };

    if (form.value.dateOfBirth) {
        form.value.dateOfBirth = new Date(form.value.dateOfBirth).toISOString().split('T')[0];
    }

    // Ensure childrenNames are populated
    const count = parseInt(form.value.numberOfChildren) || 0;
    if (Array.isArray(form.value.childrenNames)) {
      while (form.value.childrenNames.length < count) {
        form.value.childrenNames.push('');
      }
    } else {
      form.value.childrenNames = Array(count).fill('');
    }

    relationshipOptions.value = [
      { label: '-- Please select --', value: '' },
      ...relData.map(item => ({ label: item.title, value: item.lookupID })),
    ];

    nationalityOptions.value = [
      { label: '-- Please select --', value: '' },
      ...natData.map(item => ({ label: item.title, value: item.lookupID })),
    ];

    stateOptions.value = [
      { label: '-- Please select --', value: '' },
      ...stateData.map(item => ({ label: item.title, value: item.lookupID })),
    ];

  } catch (err) {
    console.error('Error fetching data:', err);
    alert('An error occurred.');
    router.push('/userManagement/parent/parents');
  }
});

async function updateParent() {
  const requiredFields = {
    relationship: 'Relationship',
    gender: 'Gender',
    dateOfBirth: 'Date of Birth',
    nationality: 'Nationality',
    phone: 'Phone',
    numberOfChildren: 'Number of Children',
    city: 'City',
    postcode: 'Postcode',
    state: 'State',
    status: 'Status',
  };

  const isEmpty = (val) =>
    val === null || val === undefined || (typeof val === 'string' && val.trim() === '');

  const missingFields = [];

  for (const [key, label] of Object.entries(requiredFields)) {
    if (isEmpty(form.value[key])) {
      missingFields.push(label);
    }
  }

  form.value.childrenNames.forEach((name, index) => {
    if (isEmpty(name)) {
      missingFields.push(`Child Name ${index + 1}`);
    }
  });

  if (missingFields.length > 0) {
    alert(`Please fill in:\n- ${missingFields.join('\n- ')}`);
    return;
  }

  try {
    const response = await fetch('/api/parents/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value),
    });

    const result = await response.json();
    if (result.statusCode === 200) {
      alert('Parent updated successfully');
      router.push('/userManagement/parent/parents');
    } else {
      alert(`Error: ${result.message}`);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
    alert('An unexpected error occurred.');
  }
}
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Edit Parent</h1>

    <FormKit
      type="select"
      v-model="form.relationship"
      label="Relationship"
      :options="relationshipOptions"
      name="relationship"
    />
    <FormKit
      type="select"
      v-model="form.gender"
      label="Gender"
      :options="['-- Please select --', 'Male', 'Female']"
    />
    <FormKit type="date" v-model="form.dateOfBirth" label="Date of Birth" />
    <FormKit
      type="select"
      v-model="form.nationality"
      label="Nationality"
      :options="nationalityOptions"
      name="nationality"
    />
    <FormKit type="number" v-model="form.phone" label="Phone" disabled />
    <FormKit
      type="number"
      v-model="form.numberOfChildren"
      label="Number of Children"
      min="1"
    />

    <div v-for="(name, index) in form.childrenNames" :key="index">
      <FormKit
        type="text"
        v-model="form.childrenNames[index]"
        :label="`Child Name ${index + 1}`"
      />
    </div>

    <FormKit type="text" v-model="form.city" label="City" />
    <FormKit type="text" v-model="form.postcode" label="Postcode" />
    <FormKit
      type="select"
      v-model="form.state"
      label="State"
      :options="stateOptions"
      name="state"
    />
    <FormKit
      type="select"
      v-model="form.status"
      label="Status"
      :options="['-- Please select --', 'Active', 'Inactive']"
    />

    <div class="flex gap-4 mt-4">
      <div class="w-1/2">
        <rs-button class="w-full" @click="updateParent">Update</rs-button>
      </div>
      <div class="w-1/2">
        <rs-button
          class="w-full bg-gray-200 hover:bg-gray-400 text-gray-800"
          variant="ghost"
          @click="router.back()"
        >
          Cancel
        </rs-button>
      </div>
    </div>
  </div>
</template>
