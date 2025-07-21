<script setup>
definePageMeta({
  title: "Dashboard",
  middleware: ["auth"],
});

import { useFetch } from '#app';

const { data: dashboardData, pending, error } = await useFetch('/api/dashboard/dashboard');

// Role-based computed properties
const userRole = computed(() => dashboardData.value?.userRole || 'unknown');

// Admin statistics
const totalUsers = computed(() => dashboardData.value?.totalUsers || 0);
const totalParents = computed(() => dashboardData.value?.totalParents || 0);
const totalDoctors = computed(() => dashboardData.value?.totalDoctors || 0);
const totalTherapists = computed(() => dashboardData.value?.totalTherapists || 0);

// Doctor statistics
const totalPatients = computed(() => dashboardData.value?.totalPatients || 0);
const totalAppointments = computed(() => dashboardData.value?.totalAppointments || 0);
const completedAppointments = computed(() => dashboardData.value?.completedAppointments || 0);
const pendingAppointments = computed(() => dashboardData.value?.pendingAppointments || 0);

const appointments = computed(() => dashboardData.value?.appointments || []);

// Check if there's an error
const hasError = computed(() => error.value || dashboardData.value?.statusCode === 401 || dashboardData.value?.statusCode === 500);
</script>

<template>
  <div class="p-4">
    <LayoutsBreadcrumb />

    <!-- Error State -->
    <div v-if="hasError" class="text-center py-8">
      <NuxtIcon name="ic:outline-error" class="text-6xl mb-4 text-red-400" />
      <p class="text-red-500 mb-4">{{ dashboardData?.message || 'Something went wrong loading the dashboard.' }}</p>
      <rs-button @click="$router.go(0)" variant="outline">Retry</rs-button>
    </div>

    <!-- Loading State -->
    <div v-else-if="pending" class="text-center py-8">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <p class="text-gray-500">Loading dashboard...</p>
    </div>

    <!-- Dashboard Content -->
    <div v-else>
      <!-- Admin Dashboard -->
      <div v-if="userRole === 'admin'">
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
      </div>

      <!-- Doctor Dashboard -->
      <div v-else-if="userRole === 'doctor'">
        <!-- Summary Cards -->
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-x-6">
          <!-- Total Patients -->
          <rs-card>
            <div class="pt-5 pb-3 px-5 flex items-center gap-4">
              <div class="p-5 flex justify-center items-center bg-indigo-100 rounded-2xl">
                <Icon class="text-indigo-500" name="ic:outline-people"></Icon>
              </div>
              <div class="flex-1 truncate">
                <span class="block font-semibold text-xl leading-tight">{{ totalPatients }}</span>
                <span class="text-base font-semibold text-gray-500">Total Patients</span>
              </div>
            </div>
          </rs-card>

          <!-- Total Appointments -->
          <rs-card>
            <div class="pt-5 pb-3 px-5 flex items-center gap-4">
              <div class="p-5 flex justify-center items-center bg-green-100 rounded-2xl">
                <Icon class="text-green-500" name="ic:outline-calendar-today"></Icon>
              </div>
              <div class="flex-1 truncate">
                <span class="block font-semibold text-xl leading-tight">{{ totalAppointments }}</span>
                <span class="text-base font-semibold text-gray-500">Total Appointments</span>
              </div>
            </div>
          </rs-card>

          <!-- Completed Appointments -->
          <rs-card>
            <div class="pt-5 pb-3 px-5 flex items-center gap-4">
              <div class="p-5 flex justify-center items-center bg-blue-100 rounded-2xl">
                <Icon class="text-blue-500" name="ic:outline-check-circle"></Icon>
              </div>
              <div class="flex-1 truncate">
                <span class="block font-semibold text-xl leading-tight">{{ completedAppointments }}</span>
                <span class="text-base font-semibold text-gray-500">Completed</span>
              </div>
            </div>
          </rs-card>

          <!-- Pending Appointments -->
          <rs-card>
            <div class="pt-5 pb-3 px-5 flex items-center gap-4">
              <div class="p-5 flex justify-center items-center bg-yellow-100 rounded-2xl">
                <Icon class="text-yellow-500" name="ic:outline-schedule"></Icon>
              </div>
              <div class="flex-1 truncate">
                <span class="block font-semibold text-xl leading-tight">{{ pendingAppointments }}</span>
                <span class="text-base font-semibold text-gray-500">Pending</span>
              </div>
            </div>
          </rs-card>
        </div>
      </div>

      <!-- Appointments for Today -->
      <div class="mt-8">
        <h2 class="text-xl font-bold mb-4">
          {{ userRole === 'doctor' ? "Today's Appointments" : "Today's Appointments" }}
        </h2>

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

        <div v-else class="text-gray-500">
          {{ userRole === 'doctor' ? 'No appointments scheduled for today.' : 'No appointments booked for today.' }}
        </div>
      </div>
    </div>
  </div>
</template>
