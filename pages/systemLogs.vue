<script setup>
import { ref } from 'vue';

const data = [
  {
    timestamp: "2024-06-10 10:00:00",
    user: "admin",
    action: "Created Appointment",
    details: "Appointment for Alice Brown with Dr. John Smith",
  },
  {
    timestamp: "2024-06-11 14:35:00",
    user: "admin",
    action: "Approved Therapist",
    details: "Therapist Jane Doe approved",
  },
  {
    timestamp: "2024-06-12 09:15:00",
    user: "user1",
    action: "Updated Profile",
    details: "User profile updated",
  }
];

const columns = [
  { name: 'timestamp', label: 'Timestamp' },
  { name: 'user', label: 'User' },
  { name: 'action', label: 'Action' },
  { name: 'details', label: 'Details' }
];
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">System Logs</h1>
    <div class="card p-4 mt-4">
      <rs-table
        :data="data"
        :columns="columns"
        :options="{
          variant: 'default',
          striped: true,
          borderless: true,
        }"
        :options-advanced="{
          sortable: true,
          responsive: true,
          filterable: false,
        }"
        advanced
      >
      </rs-table>
    </div>
  </div>
</template>