<!-- Added by: Firzana Huda 24 June 2025 -->
<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const relationshipOptions = ref([]);
const nationalityOptions = ref([]); 
const stateOptions = ref([]); 
const router = useRouter();

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
  try {
    const [relRes, natRes, stateRes] = await Promise.all([
      fetch('/api/parents/lookupRelationship'),
      fetch('/api/parents/lookupNationality'),
      fetch('/api/parents/lookupState')
    ]);

    const relJson = await relRes.json();
    const natJson = await natRes.json();
    const stateJson = await stateRes.json();

    const relData = relJson ?? [];
    const natData = natJson ?? [];
    const stateData = stateJson ?? [];


    console.log('relData:', relData);
    console.log('natData:', natData);
    console.log('stateData:', stateData);

    relationshipOptions.value = [
      { label: '-- Please select --', value: '' },
      ...relData
        .filter(item => item.lookupID !== undefined && item.lookupID !== null)
        .map(item => ({
          label: item.title,
          value: item.lookupID
        }))
    ];

    nationalityOptions.value = [
      { label: '-- Please select --', value: '' },
      ...natData
        .filter(item => item.lookupID !== undefined && item.lookupID !== null)
        .map(item => ({
          label: item.title,
          value: item.lookupID
        }))
    ];

    stateOptions.value = [
      { label: '-- Please select --', value: '' },
      ...stateData
        .filter(item => item.lookupID !== undefined && item.lookupID !== null)
        .map(item => ({
          label: item.title,
          value: item.lookupID
        }))
    ];

  } catch (err) {
    console.error('Failed to fetch dropdowns:', err);
  }
});

async function saveParentFromAddPage() {
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

  // Debugging
  // console.log("Relationship (value):", form.value.relationship, typeof form.value.relationship);
  // console.log("Nationality (value):", form.value.nationality, typeof form.value.nationality);
  // console.log("State (value):", form.value.state, typeof form.value.state);

  // Helper to check if a value is empty
  const isEmpty = (val) =>
    val === null || val === undefined || (typeof val === 'string' && val.trim() === '');

  const missingFields = [];

  // Debug: Log all form values
  // console.log('Form Data:', JSON.stringify(form.value, null, 2));
  // console.log('Nationality selected:', form.value.nationality);

  // Check required fields
  for (const [key, label] of Object.entries(requiredFields)) {
    const value = form.value[key];
    if (isEmpty(value)) {
      console.warn(`Missing field: ${label} (key: ${key}) =>`, value);
      missingFields.push(label);
    }
  }

  // Check for missing children names
  if (Array.isArray(form.value.childrenNames)) {
    form.value.childrenNames.forEach((name, index) => {
      if (isEmpty(name)) {
        console.warn(`Missing Child Name ${index + 1}:`, name);
        missingFields.push(`Child Name ${index + 1}`);
      }
    });
  }

  // If any missing, show alert
  if (missingFields.length > 0) {
    alert(`Please fill in:\n- ${missingFields.join('\n- ')}`);
    return;
  }

  // Proceed to save
  try {
    const response = await fetch('/api/parents/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value),
    });

    const result = await response.json();
    if (result.statusCode === 200) {
      alert('Parent added successfully');
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
    <h1 class="text-2xl font-bold mb-4">Parent Information</h1>

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
    <FormKit type="number" v-model="form.phone" label="Phone" />
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
        <rs-button class="w-full" @click="saveParentFromAddPage">Save</rs-button>
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
