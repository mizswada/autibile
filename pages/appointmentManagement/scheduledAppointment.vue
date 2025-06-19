<script setup> 
                    const { $FullCalendar } = useNuxtApp();
                    const FullCalendar = $FullCalendar;

                    const calendarOptions = ref(null);

                    calendarOptions.value = {
                      ...FullCalendar?.options,
                      initialView: "dayGridMonth",
                      headerToolbar: {
                        left: "prev,next title",
                        right: "dayGridMonth,timeGridWeek,listWeek",
                      },
                      dragScroll: true,
                      dayMaxEvents: 2,
                      navLinks: true,
                      events: [
                        { title: "John Doe", start: "2025-07-05", end: "2025-07-08" },
                        { title: "Erica Smith", start: "2025-07-05", end: "2025-07-08" },
                        { title: "Bella Swan", start: "2025-07-05", end: "2025-07-08" },
                        { title: "Jack Reacher", start: "2025-07-05", end: "2025-07-08" },
                        { title: "Tom Cruise", start: "2025-07-05", end: "2025-07-08" },
                        { title: "Edward Cullen", start: "2025-07-05", end: "2025-07-08" },
                        { title: "Boboiboy", date: "2025-07-22" },
                      ],
                    };

                    const changeKey = ref(0);

                    onMounted(() => {
                      setTimeout(() => {
                        changeKey.value++;
                      }, 500);
                    });
                    </script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Scheduled Appointment</h1>
    <div class="flex justify-end items-center mb-4">
      <router-link to="/appointmentManagement/newAppointment">
        <rs-button>
          <Icon name="material-symbols:add" class="mr-1" />
          New Appointment
        </rs-button>
      </router-link>
    </div>
    <div class="bg-white shadow-md rounded p-4 mb-4"> 
      <ClientOnly>
       <FullCalendar :key="changeKey" :options="calendarOptions" />
      </ClientOnly>
    </div>
  </div>
</template>