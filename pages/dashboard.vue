<script setup>
definePageMeta({
  title: "Dashboard",
  // middleware: ["auth"], // This is for Login Auth for page
  // requiresAuth: true,  // This is use for Login Auth for page
});

import { ref } from 'vue';

const totalUsers = ref(512);
const totalParents = ref(120);
const totalDoctors = ref(30);
const totalTherapists = ref(25);

// Example appointments for today (replace with real data/fetch in production)
const today = new Date().toISOString().slice(0, 10);
const appointments = ref([
  {
    patient: "Alice Brown",
    userType: "Doctor",
    userName: "Dr. John Smith",
    date: today,
    time: "10:00",
    notes: "First consultation"
  },
  {
    patient: "Bob Green",
    userType: "Therapist",
    userName: "Jane Doe",
    date: today,
    time: "14:30",
    notes: "Speech therapy session"
  }
]);
</script>

<template>
  <div class="p-4">
    <LayoutsBreadcrumb />
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-x-6">
      <!-- Total Users -->
      <rs-card>
        <div class="pt-5 pb-3 px-5 flex items-center gap-4">
          <div class="p-5 flex justify-center items-center bg-indigo-100 rounded-2xl">
            <Icon class="text-indigo-500" name="ic:outline-account-circle"></Icon>
          </div>
          <div class="flex-1 truncate">
            <span class="block font-semibold text-xl leading-tight">{{ totalUsers }}</span>
            <span class="text-base font-semibold text-gray-500">Total Users</span>
          </div>
        </div>
      </rs-card>
      <!-- Total Parents -->
      <rs-card>
        <div class="pt-5 pb-3 px-5 flex items-center gap-4">
          <div class="p-5 flex justify-center items-center bg-green-100 rounded-2xl">
            <Icon class="text-green-500" name="ic:outline-family-restroom"></Icon>
          </div>
          <div class="flex-1 truncate">
            <span class="block font-semibold text-xl leading-tight">{{ totalParents }}</span>
            <span class="text-base font-semibold text-gray-500">Total Parents</span>
          </div>
        </div>
      </rs-card>
      <!-- Total Doctors -->
      <rs-card>
        <div class="pt-5 pb-3 px-5 flex items-center gap-4">
          <div class="p-5 flex justify-center items-center bg-blue-100 rounded-2xl">
            <Icon class="text-blue-500" name="ic:outline-medical-services"></Icon>
          </div>
          <div class="flex-1 truncate">
            <span class="block font-semibold text-xl leading-tight">{{ totalDoctors }}</span>
            <span class="text-base font-semibold text-gray-500">Total Doctors</span>
          </div>
        </div>
      </rs-card>
      <!-- Total Therapists -->
      <rs-card>
        <div class="pt-5 pb-3 px-5 flex items-center gap-4">
          <div class="p-5 flex justify-center items-center bg-pink-100 rounded-2xl">
            <Icon class="text-pink-500" name="ic:outline-psychology"></Icon>
          </div>
          <div class="flex-1 truncate">
            <span class="block font-semibold text-xl leading-tight">{{ totalTherapists }}</span>
            <span class="text-base font-semibold text-gray-500">Total Therapists</span>
          </div>
        </div>
      </rs-card>
    </div>
    <!-- Appointments for Today -->
    <div class="mt-8">
      <h2 class="text-xl font-bold mb-4">Today's Appointments</h2>
      <div v-if="appointments.length > 0" class="card p-4">
        <rs-table
          :data="appointments"
          :columns="[
            { name: 'patient', label: 'Patient' },
            { name: 'userType', label: 'Type' },
            { name: 'userName', label: 'Doctor/Therapist' },
            { name: 'date', label: 'Date' },
            { name: 'time', label: 'Time' },
            { name: 'notes', label: 'Notes' }
          ]"
          :options="{ borderless: true }"
          advanced
        />
      </div>
      <div v-else class="text-gray-500">No appointments booked for today.</div>
    </div>
  </div>
</template>
