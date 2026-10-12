<script setup>
import { ref, onMounted } from 'vue';

definePageMeta({
  title: "To Bill",
});

const groups = ref([]);
const loading = ref(true);
const error = ref('');
const message = ref('');
const messageType = ref('success');
const busy = ref(false);

// Cap on unbilled sessions per patient (0 = booking needs a prepaid session)
const maxUnbilled = ref(5);
const maxAllowed = ref(50);
const savingCap = ref(false);

function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => (message.value = ''), 4000);
}

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });

async function loadGroups() {
  loading.value = true;
  error.value = '';
  try {
    const response = await $fetch('/api/appointments/unbilled');
    if (response.success) {
      groups.value = response.data;
    } else {
      error.value = response.message || 'Failed to load the list';
    }
  } catch (err) {
    console.error('Error loading unbilled appointments:', err);
    error.value = 'An error occurred while loading the list';
  } finally {
    loading.value = false;
  }
}

async function loadSettings() {
  try {
    const response = await $fetch('/api/payment/billingSettings');
    if (response.statusCode === 200) {
      maxUnbilled.value = response.data.maxUnbilled;
      maxAllowed.value = response.data.maxAllowed;
    }
  } catch (err) {
    console.error('Error loading billing settings:', err);
  }
}

async function saveCap() {
  const value = Number(maxUnbilled.value);
  if (!Number.isInteger(value) || value < 0 || value > maxAllowed.value) {
    showMessage(`Enter a whole number from 0 to ${maxAllowed.value}.`, 'error');
    return;
  }
  savingCap.value = true;
  try {
    const response = await $fetch('/api/payment/billingSettings', {
      method: 'PUT',
      body: { maxUnbilled: value },
    });
    if (response.statusCode === 200) {
      showMessage(value === 0 ? 'Saved. Booking now needs a prepaid session.' : 'Saved.');
    } else {
      showMessage(response.message || 'Could not save', 'error');
    }
  } catch (err) {
    console.error('Error saving billing settings:', err);
    showMessage(err.data?.message || 'Could not save', 'error');
  } finally {
    savingCap.value = false;
  }
}

async function waive(appointmentIds) {
  if (!confirm(`Waive billing for ${appointmentIds.length} appointment(s)? The patient will not be charged, and the session is given back so it no longer counts as owed.`)) {
    return;
  }
  const reason = prompt('Why is this not being charged? (required)');
  if (reason === null) return;
  if (reason.trim().length < 3) {
    showMessage('A reason is required to waive billing.', 'error');
    return;
  }
  busy.value = true;
  try {
    const response = await $fetch('/api/appointments/waiveBilling', {
      method: 'POST',
      body: { appointmentIds, waived: true, reason: reason.trim() },
    });
    if (response.success) {
      showMessage(response.message);
      await loadGroups();
    } else {
      showMessage(response.message || 'Could not waive billing', 'error');
    }
  } catch (err) {
    console.error('Error waiving billing:', err);
    showMessage(err.data?.message || 'Could not waive billing', 'error');
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  loadGroups();
  loadSettings();
});
</script>

<template>
  <main>
    <LayoutsBreadcrumb />

    <rs-card class="p-6">
      <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-3">
        <div>
          <h5 class="text-xl font-semibold">To Bill</h5>
          <p class="text-sm text-gray-600">
            Appointments booked when the patient had no sessions left. Create an invoice so the parent can pay.
          </p>
        </div>
        <NuxtLink to="/payment/invoices">
          <rs-button variant="ghost" size="sm">View invoices</rs-button>
        </NuxtLink>
      </div>

      <!-- Limit on unbilled sessions per patient -->
      <div class="p-4 mb-6 border border-gray-200 rounded-lg bg-gray-50">
        <div class="flex flex-wrap items-end gap-3">
          <div>
            <label class="block text-sm font-medium mb-1">Max unbilled sessions per patient</label>
            <input
              v-model.number="maxUnbilled"
              type="number"
              min="0"
              :max="maxAllowed"
              class="border border-gray-300 rounded-md px-3 py-2 w-32"
            />
          </div>
          <rs-button size="sm" :disabled="savingCap" @click="saveCap">
            {{ savingCap ? 'Saving...' : 'Save' }}
          </rs-button>
        </div>
        <p class="text-xs text-gray-600 mt-2">
          A patient with no sessions can still be booked until this many sessions are unbilled. Set 0 to require a prepaid session for every booking.
        </p>
      </div>

      <section v-if="loading" class="flex justify-center items-center py-12">
        <Icon name="line-md:loading-twotone-loop" class="text-4xl" />
      </section>

      <section v-else-if="error" class="text-center text-red-500 py-8">
        <p>{{ error }}</p>
        <rs-button class="mt-4" @click="loadGroups">Try Again</rs-button>
      </section>

      <section v-else-if="groups.length === 0" class="text-center text-gray-500 py-12">
        <Icon name="ic:outline-receipt" class="text-4xl mb-4" />
        <p>Nothing to bill. Every appointment is covered or already billed.</p>
      </section>

      <section v-else class="space-y-4">
        <div
          v-for="group in groups"
          :key="group.patient_id"
          class="border border-gray-200 rounded-lg overflow-hidden"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-amber-50 border-b border-amber-200">
            <div>
              <span class="font-semibold">{{ group.patient_name }}</span>
              <span class="ml-2 text-sm text-amber-800">{{ group.count }} session{{ group.count > 1 ? 's' : '' }} to bill</span>
            </div>
            <div class="flex gap-2">
              <NuxtLink
                :to="{ path: '/payment/create', query: { patientId: String(group.patient_id), appointmentIds: group.appointments.map((a) => a.appointment_id).join(',') } }"
              >
                <rs-button size="sm">Create invoice</rs-button>
              </NuxtLink>
              <rs-button
                size="sm"
                variant="ghost"
                class="bg-gray-200"
                :disabled="busy"
                @click="waive(group.appointments.map((a) => a.appointment_id))"
              >
                Waive all
              </rs-button>
            </div>
          </div>

          <table class="w-full text-sm">
            <tbody>
              <tr
                v-for="appointment in group.appointments"
                :key="appointment.appointment_id"
                class="border-b border-gray-100 last:border-0"
              >
                <td class="px-4 py-2 whitespace-nowrap">{{ formatDate(appointment.date) }}</td>
                <td class="px-4 py-2 text-gray-600">{{ appointment.time_slot }}</td>
                <td class="px-4 py-2 text-gray-600">{{ appointment.service_name }}</td>
                <td class="px-4 py-2 text-right whitespace-nowrap">
                  <NuxtLink
                    :to="{ path: '/appointmentManagement/newAppointment/scheduledAppointment', query: { editId: String(appointment.appointment_id) } }"
                    class="text-primary underline mr-3"
                  >
                    Open
                  </NuxtLink>
                  <button
                    type="button"
                    class="text-gray-600 underline"
                    :disabled="busy"
                    @click="waive([appointment.appointment_id])"
                  >
                    Waive
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div
        v-if="message"
        class="mt-4 p-3 rounded text-white"
        :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'"
      >
        {{ message }}
      </div>
    </rs-card>
  </main>
</template>
