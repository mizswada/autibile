<!-- Added by: Firzana Huda 24 June 2025 -->
<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const route = useRoute();
const router = useRouter();

const childID = ref(route.query.childID); 
const parentID = ref(route.query.parentID);
const userID = ref(route.query.userID);

const form = ref({
  nickname: '',
  gender: '',
  icNumber: '',
  dateOfBirth: '',
  autismDiagnose: '',
  diagnosedDate: '',
  availableSession: '',
  status: '',
});

const availableSessionOptions = ref([]);

onMounted(async () => {
  // 1. Load dropdown options
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
          value: item.lookupID,
        })),
    ];
  } catch (err) {
    console.error('Failed to fetch dropdowns:', err);
  }

  // 2. If editing, load existing child data
  if (childID.value) {
    try {
      const res = await fetch(`/api/parents/manageChild/fetchEditChild?childID=${childID.value}`);
      const result = await res.json();

      if (result.statusCode === 200 && result.data) {
        const child = result.data;

        form.value = {
          nickname: child.nickname,
          gender: child.gender,
          icNumber: child.patient_ic,
          dateOfBirth: child.dob?.split('T')[0] ?? '',
          autismDiagnose: child.autism_diagnose,
          diagnosedDate: child.diagnosed_on?.split('T')[0] ?? '',
          availableSession: child.available_session,
          status: child.status,
        };
      } else {
        alert('Failed to load child details.');
      }
    } catch (err) {
      console.error('Error loading child:', err);
      alert('Error loading child data.');
    }
  }
});

async function saveChild() {
  const requiredFields = {
    nickname: 'Nickname',
    gender: 'Gender',
    icNumber: 'IC Number',
    dateOfBirth: 'Date of Birth',
    autismDiagnose: 'Autism Diagnose',
    diagnosedDate: 'Diagnosed Date',
    availableSession: 'Available Session',
    status: 'Status',
  };

  const isEmpty = (val) =>
    val === null || val === undefined || (typeof val === 'string' && val.trim() === '');

  const missingFields = Object.entries(requiredFields)
    .filter(([key, _]) => isEmpty(form.value[key]))
    .map(([_, label]) => label);

  if (missingFields.length > 0) {
    alert(`Please fill in:\n- ${missingFields.join('\n- ')}`);
    return;
  }

  try {

    const response = await fetch('/api/parents/manageChild/updateChild', {
     method: 'PUT',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
        ...form.value,
        childID: parseInt(childID.value),
     }),
     });

    const result = await response.json();

    if (result.statusCode === 200) {
     alert('Child updated successfully');
     router.push({ path: '/userManagement/parent/manageChild' })
     //router.push('/userManagement/parent/addChild');
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
    <h1 class="text-2xl font-bold mb-4">
      {{ childID ? 'Edit Child' : 'Add Child' }}
    </h1>

    <FormKit type="text" v-model="form.nickname" label="Nickname" />
    <FormKit
      type="select"
      v-model="form.gender"
      label="Gender"
      :options="['-- Please select --', 'Male', 'Female']"
    />
    <FormKit type="number" v-model="form.icNumber" label="IC Number" />
    <FormKit type="date" v-model="form.dateOfBirth" label="Date of Birth" />
    <FormKit type="text" v-model="form.autismDiagnose" label="Autism Diagnose" />
    <FormKit type="date" v-model="form.diagnosedDate" label="Diagnosed Date" />
    <FormKit
      type="select"
      v-model="form.availableSession"
      label="Available Session"
      :options="availableSessionOptions"
    />
    <FormKit
      type="select"
      v-model="form.status"
      label="Status"
      :options="['-- Please select --', 'Active', 'Inactive']"
    />

    <div class="flex gap-4 mt-4">
      <div class="w-1/2">
        <rs-button class="w-full" @click="saveChild">Save</rs-button>
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
