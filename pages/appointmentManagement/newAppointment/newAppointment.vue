<script setup>
import { ref } from 'vue';

// Dropdown options
const patientOptions = ref([
  { label: "Alice Brown", value: "Alice Brown" },
  { label: "Bob Green", value: "Bob Green" }
]);
const appointmentTypeOptions = ref([
  { label: "Consultation", value: "Consultation" },
  { label: "Therapy", value: "Therapy" }
]);
const therapistDoctorOptions = ref([
  { label: "Dr. John Smith", value: "Dr. John Smith" },
  { label: "Jane Doe", value: "Jane Doe" }
]);
const timeSlotOptions = ref([
  { label: "09:00", value: "09:00" },
  { label: "10:00", value: "10:00" },
  { label: "14:30", value: "14:30" }
]);
const serviceIdOptions = ref([
  { label: "Service 001", value: "001" },
  { label: "Service 002", value: "002" }
]);

const appointmentForm = ref({
  date: new Date().toISOString().slice(0, 10),
  time: "",
  patient: "",
  appointmentType: "",
  therapistDoctor: "",
  serviceId: ""
});

function saveAppointment() {
  // Save logic here
  console.log('Appointment saved:', appointmentForm.value);
}
</script>

<template>
  <div class="max-w-lg mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">Book New Appointment</h1>
    <FormKit type="form" @submit="saveAppointment" :actions="false">
      <!-- Date and Time at the top -->
      <FormKit
        type="date"
        v-model="appointmentForm.date"
        name="date"
        label="Date"
      />
      <FormKit
        type="select"
        v-model="appointmentForm.time"
        name="time"
        label="Time Slot"
        :options="timeSlotOptions"
      />
      <FormKit
        type="select"
        v-model="appointmentForm.patient"
        name="patient"
        label="Patient Name"
        :options="patientOptions"
      />
      <FormKit
        type="select"
        v-model="appointmentForm.appointmentType"
        name="appointmentType"
        label="Appointment Type"
        :options="appointmentTypeOptions"
      />
      <FormKit
        type="select"
        v-model="appointmentForm.therapistDoctor"
        name="therapistDoctor"
        label="Therapist/Doctor"
        :options="therapistDoctorOptions"
      />
      <FormKit
        type="select"
        v-model="appointmentForm.serviceId"
        name="serviceId"
        label="Service ID"
        :options="serviceIdOptions"
      />
      <div class="flex justify-end mt-4">
        <rs-button type="submit" variant="primary">Save Appointment</rs-button>
      </div>
    </FormKit>
  </div>
</template>