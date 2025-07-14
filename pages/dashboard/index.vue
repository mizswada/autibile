<script setup>
definePageMeta({
  title: "Dashboard",
  // middleware: ["auth"], // Enable when auth is ready
});

import { useFetch } from '#app';

const { data: dashboardData, pending, error } = await useFetch('/api/dashboard/dashboard');

const totalUsers = computed(() => dashboardData.value?.totalUsers || 0);
const totalParents = computed(() => dashboardData.value?.totalParents || 0);
const totalDoctors = computed(() => dashboardData.value?.totalDoctors || 0);
const totalTherapists = computed(() => dashboardData.value?.totalTherapists || 0);
const appointments = computed(() => dashboardData.value?.appointments || []);
</script>

<template>
  <div class="p-4">
    <LayoutsBreadcrumb />

    <!-- Summary Cards -->
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

      <div v-if="pending" class="text-gray-500">Loading appointments...</div>

      <div v-else-if="appointments && appointments.length > 0" class="card p-4">
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

      <div v-if="error" class="text-red-500 mt-2">Error loading appointments.</div>
    </div>
  </div>
</template>
