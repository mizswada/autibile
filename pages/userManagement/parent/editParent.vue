<script setup>
// Added by: Firzana Huda 24 June 2025
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();

const relationshipOptions = ref([]);
const nationalityOptions = ref([]);
const stateOptions = ref([]);

const form = ref({
  fullName: '',
  ic: '',
  email: '',
  phone: '',
  relationship: null,
  gender: '',
  dateOfBirth: '',
  nationality: null,
  addressLine1: '',
  addressLine2: '',
  addressLine3: '',
  city: '',
  postcode: '',
  state: null,
  status: '',
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

    const data = parentData.data;

    form.value = {
      fullName: data.fullName || '',
      ic: data.ic || '',
      email: data.email || '',
      phone: data.phone || '',
      relationship: data.relationship || '',
      gender: data.gender || '',
      dateOfBirth: data.dateOfBirth
        ? new Date(data.dateOfBirth).toISOString().split('T')[0]
        : '',
      nationality: data.nationality || '',
      addressLine1: data.addressLine1 || '',
      addressLine2: data.addressLine2 || '',
      addressLine3: data.addressLine3 || '',
      city: data.city || '',
      postcode: data.postcode || '',
      state: data.state || '',
      status: data.status || '',
    };

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
  try {
    const response = await fetch('/api/parents/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form.value, parentID: route.query.parentID }),
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
    <h1 class="text-2xl font-bold mb-4">Update Parent Information</h1>

    <FormKit type="form" :actions="false">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormKit type="text" v-model="form.fullName" label="Full Name" validation="required" />
        <FormKit type="text" v-model="form.ic" label="IC Number" validation="required" />
        <FormKit type="email" v-model="form.email" label="Email" validation="required|email" />
        <FormKit type="text" v-model="form.phone" label="Phone" validation="required" />
        <FormKit
          type="select"
          v-model="form.relationship"
          label="Relationship"
          :options="relationshipOptions"
          name="relationship"
          validation="required"
        />
        <FormKit
          type="select"
          v-model="form.gender"
          label="Gender"
          :options="['-- Please select --', 'Male', 'Female']"
          validation="required"
        />
        <FormKit
          type="date"
          v-model="form.dateOfBirth"
          label="Date of Birth"
          validation="required"
        />
        <FormKit
          type="select"
          v-model="form.nationality"
          label="Nationality"
          :options="nationalityOptions"
          name="nationality"
          validation="required"
        />
        <FormKit
          type="text"
          v-model="form.addressLine1"
          label="Address Line 1"
          validation="required"
        />
        <FormKit type="text" v-model="form.addressLine2" label="Address Line 2" />
        <FormKit type="text" v-model="form.addressLine3" label="Address Line 3" />
        <FormKit type="text" v-model="form.city" label="City" validation="required" />
        <FormKit type="text" v-model="form.postcode" label="Postcode" validation="required" />
        <FormKit
          type="select"
          v-model="form.state"
          label="State"
          :options="stateOptions"
          name="state"
          validation="required"
        />
        <FormKit
          type="select"
          v-model="form.status"
          label="Status"
          :options="['-- Please select --', 'Active', 'Inactive']"
          validation="required"
        />
      </div>

      <div class="flex gap-4 mt-6">
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
    </FormKit>
  </div>
</template>

