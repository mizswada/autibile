<script setup>
import { ref, onMounted } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import { useFetch } from '#app'

const calendarOptions = ref({
  plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  headerToolbar: {
    left: "prev,next title",
    right: "dayGridMonth,timeGridWeek,listWeek",
  },
  events: []
})

const fetchAppointments = async () => {
  const { data, error } = await useFetch('/api/appointments/list')

  if (error.value) {
    console.error('Error fetching appointments:', error.value)
    return
  }

  const appointments = data.value.data || []
  calendarOptions.value.events = appointments.map(appt => ({
    id: appt.id,
    title: appt.title,
    start: appt.start,
    end: appt.end,
    allDay: false,
    backgroundColor: '#14452F',
    borderColor: '#14452F',
    textColor: '#fff',
    extendedProps: appt.extendedProps,
  }))
}

onMounted(fetchAppointments)

</script>

<template>
  <div class="p-4">
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-2xl font-bold">Scheduled Appointments</h1>
      <router-link to="/appointmentManagement/newAppointment">
        <rs-button variant="primary-outline">
          <Icon name="material-symbols:arrow-back" class="mr-1" /> Back to Appointments
        </rs-button>
      </router-link>
    </div>
    <rs-card class="p-4">
      <FullCalendar :options="calendarOptions" />
    </rs-card>
  </div>
</template>


<style>
.fc {
  background-color: #fff; /* calendar background white */
}
</style>
