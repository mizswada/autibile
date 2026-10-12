<script setup>
import { ref, computed } from 'vue';
import { useUserStore } from '~/stores/user';

// Read-only session balance with a logged "Adjust sessions" action (admins only).
// The balance is never typed in directly: sessions come from paid invoices, or from an
// adjustment that always needs a reason and is saved in the session adjustment log.
const props = defineProps({
  patientId: { type: [Number, String], required: true },
  available: { type: Number, default: 0 },
  owed: { type: Number, default: 0 },
});
const emit = defineEmits(['adjusted']);

const userStore = useUserStore();
const isAdmin = computed(() => userStore.isAdmin);

const showModal = ref(false);
const delta = ref('');
const reason = ref('');
const isSaving = ref(false);
const errorMessage = ref('');

function openModal() {
  delta.value = '';
  reason.value = '';
  errorMessage.value = '';
  showModal.value = true;
}

async function submit() {
  errorMessage.value = '';
  const change = parseInt(delta.value, 10);
  if (!Number.isInteger(change) || change === 0 || Math.abs(change) > 100) {
    errorMessage.value = 'Enter a number from 1 to 100 (use a minus sign to remove sessions).';
    return;
  }
  if (reason.value.trim().length < 3) {
    errorMessage.value = 'A reason is required.';
    return;
  }

  isSaving.value = true;
  try {
    const response = await $fetch('/api/parents/manageChild/adjustSessions', {
      method: 'POST',
      body: { patientId: Number(props.patientId), delta: change, reason: reason.value.trim() },
    });
    if (response.statusCode === 200) {
      emit('adjusted', response.data);
      showModal.value = false;
    } else {
      errorMessage.value = response.message || 'Could not adjust the sessions.';
    }
  } catch (error) {
    console.error('Adjust sessions error:', error);
    errorMessage.value = error.data?.message || 'An error occurred while adjusting the sessions.';
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="mb-4">
    <div class="font-medium mb-1">Sessions</div>
    <div class="flex items-center gap-3 flex-wrap">
      <span class="px-3 py-1 rounded-full bg-green-50 text-green-800 text-sm font-medium">
        Available: {{ available }}
      </span>
      <span v-if="owed > 0" class="px-3 py-1 rounded-full bg-red-50 text-red-700 text-sm font-medium">
        Owes: {{ owed }} (booked without sessions)
      </span>
      <rs-button v-if="isAdmin" size="sm" variant="primary-outline" @click="openModal">
        Adjust sessions
      </rs-button>
    </div>
    <p class="text-sm text-gray-600 mt-1">
      Sessions are added when a package invoice is paid. Use "Adjust sessions" only to correct a mistake or give free sessions; every change is logged.
    </p>

    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 class="text-lg font-semibold mb-4">Adjust sessions</h3>

        <label class="block text-sm font-medium mb-1">Change (+ adds, - removes)</label>
        <input
          v-model="delta"
          type="number"
          step="1"
          class="border border-gray-300 rounded-md px-3 py-2 w-full mb-3"
          placeholder="e.g. 1 or -1"
        />

        <label class="block text-sm font-medium mb-1">Reason (required)</label>
        <input
          v-model="reason"
          type="text"
          maxlength="500"
          class="border border-gray-300 rounded-md px-3 py-2 w-full mb-3"
          placeholder="e.g. Free trial session, correction for deleted booking"
        />

        <p v-if="errorMessage" class="text-sm text-red-600 mb-3">{{ errorMessage }}</p>

        <div class="flex justify-end gap-3">
          <rs-button variant="ghost" class="bg-gray-200" :disabled="isSaving" @click="showModal = false">Cancel</rs-button>
          <rs-button :disabled="isSaving" @click="submit">
            {{ isSaving ? 'Saving...' : 'Save' }}
          </rs-button>
        </div>
      </div>
    </div>
  </div>
</template>
