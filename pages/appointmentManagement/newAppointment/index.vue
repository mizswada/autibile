<script setup>
// The old appointment list lived here. The calendar page replaced it (statuses, billing and
// session rules only live there), so anyone landing on this URL is sent on.
definePageMeta({
  title: "Appointments",
  middleware: [() => navigateTo('/appointmentManagement/newAppointment/scheduledAppointment', { replace: true })],
});
</script>

<template>
  <div />
</template>
