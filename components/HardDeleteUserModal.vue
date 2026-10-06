<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // { userID, name } of the account being permanently deleted
  target: { type: Object, default: null },
});
const emit = defineEmits(['update:modelValue', 'deleted']);

const step = ref(1);
const loading = ref(false);
const loadError = ref('');
const preview = ref(null);
const acknowledged = ref(false);
const typedPhrase = ref('');
const typedIdentifier = ref('');
const adminEmail = ref('');
const adminPassword = ref('');
const submitting = ref(false);
const errorMessage = ref('');
const finished = ref(false);
const resultCounts = ref(null);

const COUNT_LABELS = {
  parent_profiles: 'Parent profiles',
  practitioner_profiles: 'Practitioner profiles',
  children_deleted: 'Children deleted',
  children_unlinked_only: 'Shared children kept (only unlinked)',
  appointments_deleted: 'Appointments deleted',
  appointments_unbooked: 'Appointments kept (booking cleared)',
  completed_sessions: 'Completed sessions (included above)',
  questionnaire_responses: 'Questionnaire responses',
  questionnaire_answers: 'Questionnaire answers',
  ai_results: 'AI analysis results',
  questionnaire_access: 'Questionnaire access rows',
  diary_reports: 'Diary reports',
  referrals: 'Referrals',
  invoices: 'Invoices',
  payments: 'Payments',
  progress_notes: 'Progress notes',
  account_requests: 'Account requests',
};

const visibleCounts = (counts) =>
  Object.entries(COUNT_LABELS)
    .filter(([key]) => counts && counts[key] > 0)
    .map(([key, label]) => ({ key, label, value: counts[key] }));

const blockers = computed(() => preview.value?.blockers || []);
const warnings = computed(() => preview.value?.warnings || []);
const impactRows = computed(() => visibleCounts(preview.value?.counts));
const resultRows = computed(() => visibleCounts(resultCounts.value));

const phraseOk = computed(
  () => !!preview.value && typedPhrase.value.trim() === preview.value.requiredPhrase,
);
const identifierOk = computed(
  () =>
    !!preview.value &&
    typedIdentifier.value.trim().toLowerCase() ===
      String(preview.value.confirmIdentifier || '').trim().toLowerCase(),
);
const canGoStep2 = computed(
  () => !loading.value && !!preview.value && blockers.value.length === 0 && acknowledged.value,
);
const canGoStep3 = computed(() => phraseOk.value && identifierOk.value);
const canDelete = computed(
  () => canGoStep3.value && !!adminEmail.value.trim() && !!adminPassword.value && !submitting.value,
);

function resetState() {
  step.value = 1;
  loading.value = false;
  loadError.value = '';
  preview.value = null;
  acknowledged.value = false;
  typedPhrase.value = '';
  typedIdentifier.value = '';
  adminEmail.value = '';
  adminPassword.value = '';
  submitting.value = false;
  errorMessage.value = '';
  finished.value = false;
  resultCounts.value = null;
}

async function loadPreview() {
  if (!props.target?.userID) return;
  loading.value = true;
  loadError.value = '';
  try {
    const res = await $fetch('/api/admin/hardDelete/preview', {
      query: { userID: props.target.userID },
    });
    if (res.statusCode === 200) {
      preview.value = res.data;
    } else {
      loadError.value = res.message || 'Could not load the deletion preview.';
    }
  } catch (err) {
    loadError.value = 'Could not load the deletion preview. Please try again.';
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.modelValue,
  (open) => {
    resetState();
    if (open) loadPreview();
  },
);

function close() {
  if (submitting.value) return;
  emit('update:modelValue', false);
}

function onModelUpdate(value) {
  if (!value) close();
}

async function submit() {
  if (!canDelete.value) return;
  submitting.value = true;
  errorMessage.value = '';
  try {
    const res = await $fetch('/api/admin/hardDelete/execute', {
      method: 'POST',
      body: {
        userID: props.target.userID,
        acknowledge: acknowledged.value,
        confirmPhrase: typedPhrase.value.trim(),
        confirmIdentifier: typedIdentifier.value.trim(),
        adminEmail: adminEmail.value.trim(),
        adminPassword: adminPassword.value,
      },
    });
    if (res.statusCode === 200) {
      resultCounts.value = res.data?.counts || null;
      adminPassword.value = '';
      finished.value = true;
      emit('deleted', props.target.userID);
    } else {
      errorMessage.value = res.message || 'The deletion failed.';
      adminPassword.value = '';
    }
  } catch (err) {
    errorMessage.value = 'The request failed. Nothing was deleted. Please try again.';
    adminPassword.value = '';
  } finally {
    submitting.value = false;
  }
}

const stepTitle = computed(() => {
  if (finished.value) return 'Account permanently deleted';
  if (step.value === 1) return 'Permanently delete: review impact (1 of 3)';
  if (step.value === 2) return 'Permanently delete: confirm (2 of 3)';
  return 'Permanently delete: verify admin (3 of 3)';
});
</script>

<template>
  <rs-modal
    :model-value="modelValue"
    :title="stepTitle"
    size="lg"
    :overlay-close="false"
    @update:model-value="onModelUpdate"
  >
    <!-- Loading / error -->
    <div v-if="loading" class="flex justify-center items-center py-8 text-gray-600">
      <Icon name="line-md:loading-twotone-loop" class="mr-2" size="22" />
      Checking what will be deleted...
    </div>
    <div v-else-if="loadError" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
      {{ loadError }}
    </div>

    <!-- Finished -->
    <div v-else-if="finished">
      <div class="bg-green-100 border border-green-400 text-green-800 px-4 py-3 rounded mb-4">
        The account and all connected data were permanently deleted. This cannot be undone.
      </div>
      <p v-if="resultRows.length" class="font-semibold mb-2">Removed:</p>
      <ul class="text-sm divide-y border rounded">
        <li v-for="row in resultRows" :key="row.key" class="flex justify-between px-3 py-1.5">
          <span>{{ row.label }}</span><span class="font-semibold">{{ row.value }}</span>
        </li>
      </ul>
    </div>

    <div v-else-if="preview">
      <!-- Who -->
      <div class="rounded border border-red-300 bg-red-50 px-4 py-3 mb-4">
        <p class="text-red-800 font-semibold">
          You are about to permanently delete this account:
        </p>
        <p class="mt-1">
          <span class="font-semibold">{{ preview.target.name || '(no name)' }}</span>
          <span v-if="preview.target.email" class="text-gray-700"> &middot; {{ preview.target.email }}</span>
        </p>
        <p class="text-sm text-gray-600">
          {{ preview.target.roles.join(', ') || 'No role' }} &middot; status: {{ preview.target.status }}
        </p>
      </div>

      <!-- Step 1 -->
      <div v-if="step === 1">
        <div v-if="blockers.length" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p class="font-semibold mb-1">This account cannot be permanently deleted:</p>
          <ul class="list-disc ml-5">
            <li v-for="b in blockers" :key="b">{{ b }}</li>
          </ul>
        </div>

        <div v-if="warnings.length" class="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 px-4 py-3 mb-4">
          <ul class="list-disc ml-5 text-sm">
            <li v-for="w in warnings" :key="w">{{ w }}</li>
          </ul>
        </div>

        <p class="font-semibold mb-2">Everything below will be erased and cannot be recovered:</p>
        <ul class="text-sm divide-y border rounded mb-4">
          <li v-for="row in impactRows" :key="row.key" class="flex justify-between px-3 py-1.5">
            <span>{{ row.label }}</span><span class="font-semibold">{{ row.value }}</span>
          </li>
          <li class="flex justify-between px-3 py-1.5 text-gray-600">
            <span>The user account, login, roles and tokens</span><span class="font-semibold">1</span>
          </li>
        </ul>

        <label class="flex items-start gap-2 cursor-pointer">
          <input v-model="acknowledged" type="checkbox" class="mt-1" :disabled="blockers.length > 0" />
          <span>I understand all of this will be permanently erased.</span>
        </label>
      </div>

      <!-- Step 2 -->
      <div v-else-if="step === 2">
        <p class="mb-2">Type this exact sentence (pasting is disabled):</p>
        <p class="font-mono text-sm bg-gray-100 border rounded px-3 py-2 mb-2 select-none">
          {{ preview.requiredPhrase }}
        </p>
        <input
          v-model="typedPhrase"
          type="text"
          class="w-full border rounded px-3 py-2 mb-1"
          :class="typedPhrase && !phraseOk ? 'border-red-400' : 'border-gray-300'"
          autocomplete="off"
          spellcheck="false"
          placeholder="Type the sentence above"
          @paste.prevent
          @drop.prevent
        />
        <p v-if="phraseOk" class="text-green-700 text-sm mb-4">Sentence matches.</p>
        <p v-else class="text-gray-500 text-sm mb-4">Must match exactly.</p>

        <p class="mb-2">
          Type this account's email/username:
          <span class="font-semibold">{{ preview.confirmIdentifier }}</span>
        </p>
        <input
          v-model="typedIdentifier"
          type="text"
          class="w-full border rounded px-3 py-2 mb-1"
          :class="typedIdentifier && !identifierOk ? 'border-red-400' : 'border-gray-300'"
          autocomplete="off"
          spellcheck="false"
          placeholder="Type the account email"
          @paste.prevent
          @drop.prevent
        />
        <p v-if="identifierOk" class="text-green-700 text-sm">Matches the account.</p>
      </div>

      <!-- Step 3 -->
      <div v-else>
        <p class="mb-3">
          Final check. Enter <span class="font-semibold">your own</span> administrator email and
          password to confirm this permanent deletion.
        </p>
        <label class="block text-sm text-gray-700 mb-1">Your admin email</label>
        <input
          v-model="adminEmail"
          type="email"
          class="w-full border border-gray-300 rounded px-3 py-2 mb-3"
          autocomplete="off"
          placeholder="admin@example.com"
        />
        <label class="block text-sm text-gray-700 mb-1">Your admin password</label>
        <input
          v-model="adminPassword"
          type="password"
          class="w-full border border-gray-300 rounded px-3 py-2 mb-3"
          autocomplete="new-password"
          placeholder="Password"
          @keyup.enter="submit"
        />
        <div v-if="errorMessage" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-2">
          {{ errorMessage }}
        </div>
        <div v-if="submitting" class="flex items-center text-gray-600 text-sm">
          <Icon name="line-md:loading-twotone-loop" class="mr-2" size="18" />
          Deleting. Do not close this window...
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <template v-if="finished">
          <rs-button @click="close">Close</rs-button>
        </template>
        <template v-else>
          <rs-button variant="secondary-outline" :disabled="submitting" @click="close">Cancel</rs-button>
          <rs-button
            v-if="step > 1 && preview"
            variant="primary-outline"
            :disabled="submitting"
            @click="step -= 1"
          >Back</rs-button>
          <rs-button
            v-if="step === 1 && preview"
            variant="danger"
            :disabled="!canGoStep2"
            @click="step = 2"
          >Next</rs-button>
          <rs-button
            v-if="step === 2 && preview"
            variant="danger"
            :disabled="!canGoStep3"
            @click="step = 3"
          >Next</rs-button>
          <rs-button
            v-if="step === 3 && preview"
            variant="danger"
            :disabled="!canDelete"
            @click="submit"
          >{{ submitting ? 'Deleting...' : 'Permanently delete' }}</rs-button>
        </template>
      </div>
    </template>
  </rs-modal>
</template>
