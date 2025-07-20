<!-- Added by: Firzana Huda 24 June 2025 -->
<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const route = useRoute();
const router = useRouter();

const childID = ref(route.query.childID); 
const parentID = ref(route.query.parentID);
const userID = ref(route.query.userID);
const isLoading = ref(false);
const isSubmitting = ref(false);

// Custom validation for IC number
const icError = ref('');

const form = ref({
  fullname: '',
  nickname: '',
  gender: '',
  icNumber: '',
  dateOfBirth: '',
  autismDiagnose: '',
  diagnosedDate: '',
  availableSession: 0, // Changed to integer with default value 0
  status: '',
});

// IC validation
watch(() => form.value.icNumber, (newVal) => {
  icError.value = '';
  if (!newVal) return;
  
  if (newVal.toString().length !== 12) {
    icError.value = 'IC number must be exactly 12 digits';
  }
});

onMounted(async () => {
  isLoading.value = true;
  
  try {
    // Load existing child data
    if (childID.value) {
      const res = await fetch(`/api/parents/manageChild/fetchEditChild?childID=${childID.value}`);
      const result = await res.json();

      if (result.statusCode === 200 && result.data) {
        const child = result.data;

        form.value = {
          fullname: child.fullname || '',
          nickname: child.nickname,
          gender: child.gender,
          icNumber: child.patient_ic,
          dateOfBirth: child.dob?.split('T')[0] ?? '',
          autismDiagnose: child.autism_diagnose,
          diagnosedDate: child.diagnosed_on?.split('T')[0] ?? '',
          availableSession: parseInt(child.available_session) || 0, // Ensure it's an integer
          status: child.status,
        };
      } else {
        alert('Failed to load child details.');
      }
    }
  } catch (err) {
    console.error('Error loading data:', err);
    alert('An error occurred while loading data.');
  } finally {
    isLoading.value = false;
  }
});

async function saveChild() {
  const requiredFields = {
    fullname: 'Full Name',
    nickname: 'Nickname',
    gender: 'Gender',
    icNumber: 'IC Number',
    dateOfBirth: 'Date of Birth',
    autismDiagnose: 'Autism Diagnose',
    diagnosedDate: 'Diagnosed Date',
    availableSession: 'Available Sessions',
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
  
  // Validate IC number
  if (form.value.icNumber.toString().length !== 12) {
    icError.value = 'IC number must be exactly 12 digits';
    alert('IC number must be exactly 12 digits.');
    return;
  }

  isSubmitting.value = true;
  
  try {
    const response = await fetch('/api/parents/manageChild/updateChild', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form.value,
        availableSession: parseInt(form.value.availableSession) || 0, // Ensure it's sent as integer
        childID: parseInt(childID.value),
      }),
    });

    const result = await response.json();

    if (result.statusCode === 200) {
      alert('Child updated successfully');
      router.push({ path: '/userManagement/parent/addChild', query: { parentID: parentID.value, userID: userID.value } });
    } else {
      alert(`Error: ${result.message}`);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
    alert('An unexpected error occurred.');
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">
      {{ childID ? 'Edit Child' : 'Add Child' }}
    </h1>

    <div v-if="isLoading" class="flex justify-center my-8">
      <div class="flex flex-col items-center">
        <Icon name="line-md:loading-twotone-loop" size="48" class="text-primary mb-2" />
        <span>Loading child data...</span>
      </div>
    </div>

    <div v-else>
      <FormKit type="text" v-model="form.fullname" label="Full Name" />
      <FormKit type="text" v-model="form.nickname" label="Nickname" />
      <FormKit
        type="select"
        v-model="form.gender"
        label="Gender"
        :options="['-- Please select --', 'Male', 'Female']"
      />
      <FormKit type="text" v-model="form.icNumber" label="IC Number" placeholder="Enter 12 digit IC number" />
      <p v-if="icError" class="text-red-500 text-sm mt-1 mb-2">{{ icError }}</p>
      <FormKit type="date" v-model="form.dateOfBirth" label="Date of Birth" />
      <FormKit type="text" v-model="form.autismDiagnose" label="Autism Diagnose" />
      <FormKit type="date" v-model="form.diagnosedDate" label="Diagnosed Date" />
      <FormKit
        type="number"
        v-model="form.availableSession"
        label="Available Sessions"
        validation="required|number|min:0"
        placeholder="0"
      />
      <p class="text-sm text-gray-600 mt-1">Available sessions count. Sessions can be added through package purchases.</p>
      <FormKit
        type="select"
        v-model="form.status"
        label="Status"
        :options="['-- Please select --', 'Active', 'Inactive']"
      />

      <div class="flex gap-4 mt-4">
        <div class="w-1/2">
          <rs-button class="w-full" @click="saveChild" :disabled="isSubmitting">
            <div class="flex items-center justify-center">
              <Icon v-if="isSubmitting" name="line-md:loading-twotone-loop" class="mr-2" />
              <span>{{ isSubmitting ? 'Updating...' : 'Save' }}</span>
            </div>
          </rs-button>
        </div>
        <div class="w-1/2">
          <rs-button
            class="w-full bg-gray-200 hover:bg-gray-400 text-gray-800"
            variant="ghost"
            @click="router.back()"
            :disabled="isSubmitting"
          >
            Cancel
          </rs-button>
        </div>
      </div>
    </div>
  </div>
</template>
