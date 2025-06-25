<!-- Added by: Firzana Huda 24 June 2025 -->
<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useRoute } from 'vue-router';

const route = useRoute();
const parentID = ref(null);
const router = useRouter();
const availableSessionOptions = ref([]); 

const form = ref({
  nickname: null,
  gender: '',
  dateOfBirth: '',
  autismDiagnose: null,
  diagnosedDate: '',
  availableSession: '',
  status: '',
});

onMounted(() => {
  parentID.value = route.query.parentID;
});

onMounted(async () => {
  try {
    const availRes = await fetch('/api/parents/lookupAvailSession');
    const availJson = await availRes.json();
    const availData = availJson ?? [];

    availableSessionOptions.value = [
      { label: '-- Please select --', value: '' },
      ...availData
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

async function saveChildFromAddPage() {
  const requiredFields = {
    nickname: 'Nickname',
    gender: 'Gender',
    dateOfBirth: 'Date of Birth',
    autismDiagnose: 'Autism Diagnose',
    diagnosedDate: 'Diagnosed Date',
    availableSession: 'Available Session',
    status: 'Status',
  };

  const isEmpty = (val) =>
    val === null || val === undefined || (typeof val === 'string' && val.trim() === '');

  const missingFields = [];

  for (const [key, label] of Object.entries(requiredFields)) {
    const value = form.value[key];
    if (isEmpty(value)) {
      missingFields.push(label);
    }
  }

  if (missingFields.length > 0) {
    alert(`Please fill in:\n- ${missingFields.join('\n- ')}`);
    return;
  }

  try {
    const response = await fetch('/api/parents/manageChild/insertChild', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form.value,
        parentID: parseInt(parentID.value),
      }),
    });

    const result = await response.json();
    if (result.statusCode === 200) {
      alert('Child added successfully');
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
    <h1 class="text-2xl font-bold mb-4">Patient Information</h1>

    <FormKit type="text" v-model="form.nickname" label="Nickname" />
    <FormKit
      type="select"
      v-model="form.gender"
      label="Gender"
      :options="['-- Please select --', 'Male', 'Female']"
    />
    <FormKit type="date" v-model="form.dateOfBirth" label="Date of Birth" />
    <FormKit type="text" v-model="form.autismDiagnose" label="Autism Diagnose" />
    <FormKit type="date" v-model="form.diagnosedDate" label="Diagnosed Date" />
    <FormKit
        type="select"
        v-model="form.availableSession"
        label="Available Session"
        :options="availableSessionOptions"
        name="availableSession"
    />
    <FormKit
      type="select"
      v-model="form.status"
      label="Status"
      :options="['-- Please select --', 'Active', 'Inactive']"
    />

    <div class="flex gap-4 mt-4">
      <div class="w-1/2">
        <rs-button class="w-full" @click="saveChildFromAddPage">Save</rs-button>
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
