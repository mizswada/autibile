<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();

const parentID = ref(route.query.parentID);
const userID = ref(route.query.userID);
const children = ref([]);
const showAddForm = ref(false);

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

// Fetch existing children for this parent
async function fetchChildren() {
  try {
    const [childRes, sessionRes] = await Promise.all([
      fetch(`/api/parents/manageChild/listChild?parentID=${parentID.value}`),
      fetch('/api/parents/lookupAvailSession')
    ]);
    const childData = await childRes.json();
    const sessionData = await sessionRes.json();

    const sessionMap = Object.fromEntries(sessionData.map(s => [s.lookupID, s.title]));

    if (childData.statusCode === 200) {
      children.value = childData.data.map(c => ({
        ...c,
        diagnosedDate: new Date(c.diagnosedDate).toISOString().split('T')[0],
        availableSessionName: sessionMap[c.availableSession] || 'Unknown'
      }));
    }

    availableSessionOptions.value = [
      { label: '-- Please select --', value: '' },
      ...sessionData.map(s => ({ label: s.title, value: s.lookupID }))
    ];
  } catch (err) {
    console.error('Failed to load children:', err);
  }
}

// Save new child
async function saveChild() {
  try {
    console.log('Saving child with:', {
      ...form.value,
      parentID: parseInt(parentID.value),
      userID: parseInt(userID.value),
    });

    const response = await fetch('/api/parents/manageChild/insertChild', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form.value, parentID: parseInt(parentID.value), userID: parseInt(userID.value) })
    });

    const result = await response.json();
    if (result.statusCode === 200) {
      alert('Child added successfully');
      showAddForm.value = false;
      form.value = {
        nickname: null,
        gender: '',
        dateOfBirth: '',
        autismDiagnose: null,
        diagnosedDate: '',
        availableSession: '',
        status: '',
      };
      await fetchChildren(); // Refresh table
    } else {
      alert(`Error: ${result.message}`);
    }
  } catch (err) {
    alert('Failed to add child.');
  }
}

onMounted(fetchChildren);
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Manage Children for Parent {{ fullName }}</h1>

    <!-- Child List -->
    <div class="card p-4 mb-4">
      <div class="flex justify-between items-center mb-3">
        <h2 class="text-lg font-semibold">Existing Children</h2>
        <rs-button @click="showAddForm = true">
          <Icon name="material-symbols:add" class="mr-1" /> Add Child
        </rs-button>
      </div>

      <table class="min-w-full border border-gray-300 text-sm">
        <thead class="bg-gray-100">
          <tr>
            <th class="px-3 py-2 border">Child ID</th>
            <th class="px-3 py-2 border">Nickname</th>
            <th class="px-3 py-2 border">Gender</th>
            <th class="px-3 py-2 border">Diagnosed Date</th>
            <th class="px-3 py-2 border">Session</th>
            <th class="px-3 py-2 border">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="child in children" :key="child.childID">
            <td class="px-3 py-2 border">{{ child.childID }}</td>
            <td class="px-3 py-2 border">{{ child.nickname }}</td>
            <td class="px-3 py-2 border">{{ child.gender }}</td>
            <td class="px-3 py-2 border">{{ child.diagnosedDate }}</td>
            <td class="px-3 py-2 border">{{ child.availableSessionName }}</td>
            <td class="px-3 py-2 border">{{ child.status }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add Child Form -->
    <div v-if="showAddForm" class="card p-4 border border-gray-200">
      <h2 class="text-lg font-semibold mb-2">Add New Child</h2>
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
      />
      <FormKit
        type="select"
        v-model="form.status"
        label="Status"
        :options="['-- Please select --', 'Active', 'Inactive']"
      />

      <div class="flex gap-4 mt-4">
        <rs-button class="w-full" @click="saveChild">Save</rs-button>
        <rs-button variant="ghost" class="w-full bg-gray-200" @click="showAddForm = false">Cancel</rs-button>
      </div>
    </div>
  </div>
</template>
