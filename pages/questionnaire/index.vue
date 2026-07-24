<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const modalErrorMessage = ref('');
const questionnaires = ref([]);
const isLoading = ref(true);

const emptyQuestionnaireForm = () => ({
  name: '',
  description: '',
  status: '',
  minAgeYears: '',
  minAgeMonths: '',
  maxAgeYears: '',
  maxAgeMonths: '',
  ageWarningEnabled: true,
  ageWarningMessage: '',
});

const showQuestionnaireModal = ref(false);
const newQuestionnaire = ref(emptyQuestionnaireForm());
const isEditingQuestionnaire = ref(false);
const editQuestionnaireId = ref(null);
const originalAgeLimits = ref({ min: null, max: null });

const message = ref('');
const messageType = ref('success'); // 'success' or 'error'

// For status toggle
const showConfirmToggleModal = ref(false);
const pendingToggleQuestionnaire = ref(null);
const isTogglingStatus = ref(false);

// For delete functionality
const showDeleteModal = ref(false);
const pendingDeleteQuestionnaire = ref(null);
const isDeleting = ref(false);

// Confirm before M-CHAT-R age limit change (auto-disables out-of-range children)
const showConfirmAgeLimitModal = ref(false);
const pendingAgeLimitPayload = ref(null);
const isSavingAgeLimitChange = ref(false);

function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;

  // Clear message after 3 seconds
  setTimeout(() => {
    message.value = '';
  }, 3000);
}

function totalMonthsToParts(totalMonths) {
  if (totalMonths === null || totalMonths === undefined) {
    return { years: '', months: '' };
  }
  const value = Number(totalMonths);
  if (Number.isNaN(value) || value < 0) {
    return { years: '', months: '' };
  }
  return {
    years: String(Math.floor(value / 12)),
    months: String(value % 12),
  };
}

function partsToTotalMonths(years, months) {
  const hasYears = years !== '' && years !== null && years !== undefined;
  const hasMonths = months !== '' && months !== null && months !== undefined;
  if (!hasYears && !hasMonths) return null;

  const y = hasYears ? Number(years) : 0;
  const m = hasMonths ? Number(months) : 0;
  if (Number.isNaN(y) || Number.isNaN(m) || y < 0 || m < 0 || m > 11) {
    return NaN;
  }
  return y * 12 + m;
}

function formatAgeRangeDisplay(minAgeMonths, maxAgeMonths) {
  const format = (total) => {
    if (total === null || total === undefined) return null;
    const years = Math.floor(total / 12);
    const months = total % 12;
    const parts = [];
    if (years > 0) parts.push(`${years}y`);
    if (months > 0 || years === 0) parts.push(`${months}m`);
    return parts.join(' ');
  };

  const minLabel = format(minAgeMonths);
  const maxLabel = format(maxAgeMonths);
  if (!minLabel && !maxLabel) return 'No age limit';
  if (minLabel && maxLabel) return `${minLabel} – ${maxLabel}`;
  if (minLabel) return `${minLabel}+`;
  return `up to ${maxLabel}`;
}

const isEditingProtected = computed(
  () => isEditingQuestionnaire.value && isProtectedQuestionnaire(editQuestionnaireId.value),
);

onMounted(fetchQuestionnaires)

async function fetchQuestionnaires() {
  isLoading.value = true;
  try {
    const res = await fetch('/api/questionnaire/listQuestionnaires')
    const result = await res.json()

    if (res.ok && result.data) {
      // Map API response to match your frontend structure
      questionnaires.value = result.data.map(q => ({
        id: q.questionnaire_id,
        name: q.title,
        description: q.description,
        status: q.status,
        min_age_months: q.min_age_months,
        max_age_months: q.max_age_months,
        age_warning_enabled: q.age_warning_enabled !== false,
        age_warning_message: q.age_warning_message || '',
        questions: q.questionnaires_questions.map(qn => ({
          id: qn.question_id,
          question_bm: qn.question_text_bm,
          question_en: qn.question_text_bi,
          requiredQuestion: qn.is_required,
          status: qn.status,
          question: `${qn.question_text_bm} / ${qn.question_text_bi}`,
          action: 'edit',
        }))
      }))
      .sort((a, b) => {
        if (a.id === 1) return -1;
        if (b.id === 1) return 1;
        return 0;
      })

    } else {
      console.error('Failed to load autism screenings:', result.message)
    }
  } catch (err) {
          console.error('Error loading autism screenings:', err)
  } finally {
    isLoading.value = false;
  }
}


function openAddQuestionnaireModal() {
  newQuestionnaire.value = emptyQuestionnaireForm();
  isEditingQuestionnaire.value = false;
  editQuestionnaireId.value = null;
  originalAgeLimits.value = { min: null, max: null };
  modalErrorMessage.value = '';
  showQuestionnaireModal.value = true;
}

function openEditQuestionnaireModal(q) {
  const minParts = totalMonthsToParts(q.min_age_months);
  const maxParts = totalMonthsToParts(q.max_age_months);

  newQuestionnaire.value = {
    name: q.name,
    description: q.description,
    status: q.status,
    minAgeYears: minParts.years,
    minAgeMonths: minParts.months,
    maxAgeYears: maxParts.years,
    maxAgeMonths: maxParts.months,
    ageWarningEnabled: q.age_warning_enabled !== false,
    ageWarningMessage: q.age_warning_message || '',
  };
  isEditingQuestionnaire.value = true;
  editQuestionnaireId.value = q.id;
  originalAgeLimits.value = {
    min: q.min_age_months ?? null,
    max: q.max_age_months ?? null,
  };
  modalErrorMessage.value = '';
  showQuestionnaireModal.value = true;
}

function buildQuestionnairePayload(minAge, maxAge) {
  return {
    title: newQuestionnaire.value.name,
    description: newQuestionnaire.value.description,
    status: newQuestionnaire.value.status,
    min_age_months: minAge,
    max_age_months: maxAge,
    age_warning_enabled: isProtectedQuestionnaire(editQuestionnaireId.value)
      ? false
      : newQuestionnaire.value.ageWarningEnabled !== false &&
        newQuestionnaire.value.ageWarningEnabled !== 'false',
    age_warning_message: isProtectedQuestionnaire(editQuestionnaireId.value)
      ? null
      : (newQuestionnaire.value.ageWarningMessage || '').trim() || null,
  };
}

async function persistQuestionnaire(payload) {
  try {
    let res;
    let result;

    if (isEditingQuestionnaire.value) {
      res = await fetch('/api/questionnaire/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          questionnaireID: editQuestionnaireId.value,
        }),
      });

      result = await res.json();

      if (res.ok && result.data) {
        const index = questionnaires.value.findIndex(
          (q) => q.id === editQuestionnaireId.value,
        );
        if (index !== -1) {
          questionnaires.value[index] = {
            ...questionnaires.value[index],
            name: result.data.title,
            description: result.data.description,
            status: result.data.status,
            min_age_months: result.data.min_age_months,
            max_age_months: result.data.max_age_months,
            age_warning_enabled: result.data.age_warning_enabled !== false,
            age_warning_message: result.data.age_warning_message || '',
          };
        }

        showQuestionnaireModal.value = false;
        modalErrorMessage.value = '';
        showMessage(
          result.message || 'Autism screening updated successfully.',
          'success',
        );
        return true;
      }

      console.error('Failed to update autism screening:', result.message);
      modalErrorMessage.value =
        result.message || 'Failed to update autism screening.';
      return false;
    }

    res = await fetch('/api/questionnaire/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    result = await res.json();

    if (res.ok && result.data) {
      questionnaires.value.push({
        id: result.data.questionnaire_id,
        name: result.data.title,
        description: result.data.description,
        status: result.data.status,
        min_age_months: result.data.min_age_months,
        max_age_months: result.data.max_age_months,
        age_warning_enabled: result.data.age_warning_enabled !== false,
        age_warning_message: result.data.age_warning_message || '',
        questions: [],
      });

      showQuestionnaireModal.value = false;
      modalErrorMessage.value = '';
      showMessage('Autism screening inserted successfully.', 'success');
      return true;
    }

    console.error('Failed to insert autism screening:', result.message);
    modalErrorMessage.value =
      result.message || 'Failed to insert autism screening.';
    return false;
  } catch (err) {
    console.error('Error while saving autism screening:', err);
    modalErrorMessage.value = 'An unexpected error occurred.';
    return false;
  }
}

async function saveQuestionnaire() {
  if (!newQuestionnaire.value.name.trim()) return;

  const minAge = partsToTotalMonths(
    newQuestionnaire.value.minAgeYears,
    newQuestionnaire.value.minAgeMonths,
  );
  const maxAge = partsToTotalMonths(
    newQuestionnaire.value.maxAgeYears,
    newQuestionnaire.value.maxAgeMonths,
  );

  if (Number.isNaN(minAge) || Number.isNaN(maxAge)) {
    modalErrorMessage.value =
      'Age months must be between 0 and 11. Leave fields empty for no limit.';
    return;
  }

  if (minAge !== null && maxAge !== null && minAge > maxAge) {
    modalErrorMessage.value = 'Minimum age cannot be greater than maximum age.';
    return;
  }

  const payload = buildQuestionnairePayload(minAge, maxAge);

  // Changing M-CHAT-R age limits auto lock/unlock children — confirm first.
  // Other questionnaires only warn parents; no access sync.
  const ageChanged =
    isEditingQuestionnaire.value &&
    isProtectedQuestionnaire(editQuestionnaireId.value) &&
    (minAge !== originalAgeLimits.value.min ||
      maxAge !== originalAgeLimits.value.max);

  if (ageChanged) {
    pendingAgeLimitPayload.value = payload;
    showConfirmAgeLimitModal.value = true;
    return;
  }

  await persistQuestionnaire(payload);
}

function cancelAgeLimitChange() {
  pendingAgeLimitPayload.value = null;
  showConfirmAgeLimitModal.value = false;
}

async function confirmAgeLimitChange() {
  if (!pendingAgeLimitPayload.value) return;
  isSavingAgeLimitChange.value = true;
  try {
    const ok = await persistQuestionnaire(pendingAgeLimitPayload.value);
    if (ok) {
      showConfirmAgeLimitModal.value = false;
      pendingAgeLimitPayload.value = null;
    }
  } finally {
    isSavingAgeLimitChange.value = false;
  }
}

// Status toggle functions
function confirmToggleStatus(questionnaire) {
  // Don't allow status changes for protected questionnaire
  if (isProtectedQuestionnaire(questionnaire.id)) {
          showMessage('This autism screening status cannot be changed as it is a system autism screening.', 'error');
    return;
  }
  
  pendingToggleQuestionnaire.value = questionnaire;
  showConfirmToggleModal.value = true;
}

function cancelToggleStatus() {
  pendingToggleQuestionnaire.value = null;
  showConfirmToggleModal.value = false;
}

async function performToggleStatus() {
  const questionnaire = pendingToggleQuestionnaire.value;
  const newStatus = questionnaire.status === 'Active' ? 'Inactive' : 'Active';
  isTogglingStatus.value = true;

  try {
    const res = await fetch('/api/questionnaire/updateStatus', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        questionnaireID: questionnaire.id, 
        status: newStatus 
      }),
    });

    const result = await res.json();
    if (res.ok) {
      questionnaire.status = newStatus;
              showMessage(`Autism screening status updated to ${newStatus}`, 'success');
    } else {
      showMessage(`Error updating status: ${result.message}`, 'error');
    }
  } catch (err) {
    console.error('Status update error:', err);
    showMessage('An error occurred while updating status.', 'error');
  } finally {
    showConfirmToggleModal.value = false;
    pendingToggleQuestionnaire.value = null;
    isTogglingStatus.value = false;
  }
}

// Delete functions
function confirmDelete(questionnaire) {
  // Don't allow deletion of protected questionnaire
  if (isProtectedQuestionnaire(questionnaire.id)) {
          showMessage('This autism screening cannot be deleted as it is a system autism screening.', 'error');
    return;
  }
  
  pendingDeleteQuestionnaire.value = questionnaire;
  showDeleteModal.value = true;
}

// Function to check if a questionnaire is protected (system questionnaire)
function isProtectedQuestionnaire(id) {
  return id === 1;
}

function cancelDelete() {
  pendingDeleteQuestionnaire.value = null;
  showDeleteModal.value = false;
}

async function performDelete() {
  const questionnaire = pendingDeleteQuestionnaire.value;
  isDeleting.value = true;

  try {
    const res = await fetch(`/api/questionnaire/delete?questionnaireID=${questionnaire.id}`, {
      method: 'DELETE'
    });

    const result = await res.json();
    if (result.statusCode === 200) {
      // Remove the deleted questionnaire from the list
      questionnaires.value = questionnaires.value.filter(q => q.id !== questionnaire.id);
              showMessage('Autism screening deleted successfully', 'success');
    } else {
              showMessage(`Error deleting autism screening: ${result.message}`, 'error');
    }
  } catch (err) {
    console.error('Delete error:', err);
          showMessage('An error occurred while deleting the autism screening.', 'error');
  } finally {
    showDeleteModal.value = false;
    pendingDeleteQuestionnaire.value = null;
    isDeleting.value = false;
  }
}

function navigateToQuestions(questionnaireId) {
  router.push(`/questionnaire/questions/${questionnaireId}`);
}
</script>

<style>
.formkit-label::after {
  content: '*';
  color: red;
  margin-left: 4px;
}

.toggle-checkbox {
  width: 42px;
  height: 22px;
  appearance: none;
  background-color: #ddd;
  border-radius: 12px;
  position: relative;
  outline: none;
  cursor: pointer;
  transition: background-color 0.3s ease;
}
.toggle-checkbox:checked {
  background-color: #10b981;
}
.toggle-checkbox::before {
  content: "";
  width: 18px;
  height: 18px;
  background: white;
  position: absolute;
  top: 2px;
  left: 2px;
  border-radius: 50%;
  transition: transform 0.3s ease;
}
.toggle-checkbox:checked::before {
  transform: translateX(20px);
}
</style>

<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-2xl font-bold">Autism Screening</h1>
      <div class="flex gap-2">
        <rs-button @click="router.push('/questionnaire/results')">
          <Icon name="material-symbols:analytics-outline" class="mr-1" />
          View Responses
        </rs-button>
        <rs-button @click="openAddQuestionnaireModal">
          <Icon name="material-symbols:add" class="mr-1" />
          Add Autism Screening
        </rs-button>
      </div>
    </div>
    <div v-if="message" class="mb-4 p-3 rounded text-white"
        :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
      {{ message }}
    </div>

    <!-- Loading indicator -->
    <div v-if="isLoading" class="flex justify-center my-8">
      <div class="flex flex-col items-center">
        <Icon name="line-md:loading-twotone-loop" size="48" class="text-primary mb-2" />
        <span>Loading autism screenings...</span>
      </div>
    </div>

    <!-- No data display -->
    <div v-else-if="questionnaires.length === 0" class="card p-8 text-center">
      <div class="flex flex-col items-center">
        <Icon name="material-symbols:folder-off-outline" size="64" class="text-gray-400 mb-4" />
        <h3 class="text-xl font-medium text-gray-600 mb-2">No Autism Screenings Found</h3>
        <p class="text-gray-500 mb-6">There are no autism screenings in the system yet.</p>
        <rs-button @click="openAddQuestionnaireModal">
          <Icon name="material-symbols:add" class="mr-1" />
          Create Your First Autism Screening
        </rs-button>
      </div>
    </div>

    <!-- Questionnaire list -->
    <div v-else v-for="q in questionnaires" :key="q.id" class="card mb-6 p-4">
      <div class="flex justify-between items-center mb-2">
        <div>
          <h2 class="text-xl font-semibold">{{ q.name }}</h2>
          <p class="text-sm text-gray-500">{{ q.description }} | <span :class="q.status === 'Active' ? 'text-green-600' : 'text-red-500'">{{ q.status }}</span></p>
          <p class="text-sm text-gray-500 mt-1">
            <span class="font-medium">Questions:</span> {{ q.questions.length }}
            <span class="mx-2">|</span>
            <span class="font-medium">Age range:</span> {{ formatAgeRangeDisplay(q.min_age_months, q.max_age_months) }}
            <template v-if="!isProtectedQuestionnaire(q.id)">
              <span class="mx-2">|</span>
              <span class="font-medium">Age warning:</span> {{ q.age_warning_enabled ? 'On' : 'Off' }}
            </template>
          </p>
        </div>
        <div class="flex gap-2 items-center">
          <!-- <div class="flex items-center gap-2 mr-2">
            <span class="text-sm text-gray-500">Status:</span>
            <input
              type="checkbox"
              class="toggle-checkbox"
              :checked="q.status === 'Active'"
              @click.prevent="confirmToggleStatus(q)"
            />
          </div> -->
          
        <div class="table-action-group">
          <Icon
            name="material-symbols:edit-outline-rounded"
            class="table-action-icon table-action-icon--primary"
            size="22"
            @click="openEditQuestionnaireModal(q)"
            :title="isProtectedQuestionnaire(q.id) ? 'Edit Age Limits' : 'Edit Questionnaire'"
          />
          
          <Icon
            name="material-symbols:list-alt-outline"
            class="table-action-icon table-action-icon--neutral"
            size="22"
            @click="router.push(`/questionnaire/questions/${q.id}`)"
            title="Manage Questions"
          />
          
          <Icon
            name="material-symbols:analytics-outline"
            class="table-action-icon table-action-icon--neutral"
            size="22"
            @click="router.push(`/questionnaire/thresholds/${q.id}`)"
            title="Manage Scoring Thresholds"
          />

          <Icon
            name="material-symbols:functions"
            class="table-action-icon table-action-icon--neutral"
            size="22"
            @click="router.push(`/questionnaire/composite-scoring/${q.id}`)"
            title="Configure Composite Scoring"
          />
          
          <Icon
            v-if="!isProtectedQuestionnaire(q.id)"
            name="material-symbols:delete-outline"
            class="table-action-icon table-action-icon--danger"
            size="22"
            @click="confirmDelete(q)"
            title="Delete Questionnaire"
          />

          <button
            class="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
            @click="router.push(`/questionnaire/take/${q.id}`)"
            title="Take Autism Screening"
          >
            View
          </button>
        </div>
      </div>
    </div>
    </div>

    <!-- Add a help section explaining the workflow -->
    <div class="card p-4 mb-6 bg-blue-50 border border-blue-200">
      <h3 class="font-semibold text-lg mb-2">How to Create a Complete Autism Screening</h3>
      <ol class="list-decimal ml-6 space-y-2">
        <li>Create an autism screening using the <strong>Add Autism Screening</strong> button</li>
        <li>Add questions to your autism screening using the <strong>Manage Questions</strong> button</li>
        <li>For each question, add answer options using the <strong>Manage Options</strong> button</li>
        <li>Define scoring thresholds using the <strong>Manage Scoring Thresholds</strong> button to provide interpretations based on total scores</li>
        <li>Once you've added options to your questions, use the <strong>Take Autism Screening</strong> button to test it</li>
        <li>View responses using the <strong>View Responses</strong> button</li>
      </ol>
    </div>

    <!-- Add/Edit Autism Screening Modal -->
    <rs-modal
      :title="isEditingQuestionnaire ? 'Edit Autism Screening' : 'Add Autism Screening'"
      cancel-title="Cancel"
      v-model="showQuestionnaireModal"
      :overlay-close="false"
      :hide-footer="true"
    >
      <div v-if="modalErrorMessage" class="mb-3 p-2 rounded bg-red-100 text-red-700 border border-red-300">
        {{ modalErrorMessage }}
      </div>

      <FormKit type="form" @submit="saveQuestionnaire" :actions="false">
        <FormKit
          type="text"
          v-model="newQuestionnaire.name"
          name="questionnaireName"
          label="Autism Screening Name"
          placeholder="Enter autism screening title"
          validation="required"
          validation-visibility="dirty"
          :validation-messages="{ required: 'This field is required' }"
          :disabled="isEditingProtected"
        />
        <FormKit
          type="text"
          v-model="newQuestionnaire.description"
          name="questionnaireDescription"
          label="Autism Screening Description"
          placeholder="Enter autism screening description"
          validation="required"
          validation-visibility="dirty"
          :validation-messages="{ required: 'This field is required' }"
          :disabled="isEditingProtected"
        />
        <FormKit
          type="select"
          v-model="newQuestionnaire.status"
          name="questionnaireStatus"
          label="Autism Screening Status"
          :options="[
            { label: '-- Please select --', value: '' },
            { label: 'Active', value: 'Active' },
            { label: 'Inactive', value: 'Inactive' }
          ]"
          validation="required"
          validation-visibility="dirty"
          :validation-messages="{ required: 'This field is required' }"
          :disabled="isEditingProtected"
        />

        <div class="mt-4 mb-2">
          <p class="font-medium text-sm text-gray-700">Age Limit (optional)</p>
          <p class="text-xs text-gray-500 mb-3">
            Leave blank for no limit. Ages are stored as total months.
            <span v-if="isEditingProtected">
              Outside this range, M-CHAT-R is locked by default for new children.
              Changing these limits will disable M-CHAT-R for children now outside the range and unlock it for children now inside the range.
              Admins can still override individual children with a confirmation.
            </span>
            <span v-else>
              Outside this range, parents can still answer — the app shows a warning only.
            </span>
          </p>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-sm font-medium mb-1">Minimum Age</p>
            <div class="flex gap-2 items-end">
              <FormKit
                type="number"
                v-model="newQuestionnaire.minAgeYears"
                name="minAgeYears"
                label="Years"
                placeholder="0"
                :min="0"
                number="integer"
              />
              <FormKit
                type="number"
                v-model="newQuestionnaire.minAgeMonths"
                name="minAgeMonthsPart"
                label="Months"
                placeholder="0"
                :min="0"
                :max="11"
                number="integer"
              />
            </div>
          </div>
          <div>
            <p class="text-sm font-medium mb-1">Maximum Age</p>
            <div class="flex gap-2 items-end">
              <FormKit
                type="number"
                v-model="newQuestionnaire.maxAgeYears"
                name="maxAgeYears"
                label="Years"
                placeholder="0"
                :min="0"
                number="integer"
              />
              <FormKit
                type="number"
                v-model="newQuestionnaire.maxAgeMonths"
                name="maxAgeMonthsPart"
                label="Months"
                placeholder="0"
                :min="0"
                :max="11"
                number="integer"
              />
            </div>
          </div>
        </div>

        <FormKit
          v-if="!isEditingProtected"
          type="select"
          v-model="newQuestionnaire.ageWarningEnabled"
          name="ageWarningEnabled"
          label="Show age warning in app"
          help="When the child is outside the age range, show a popup before they continue."
          :options="[
            { label: 'Yes', value: true },
            { label: 'No', value: false }
          ]"
        />

        <FormKit
          v-if="!isEditingProtected && newQuestionnaire.ageWarningEnabled !== false && newQuestionnaire.ageWarningEnabled !== 'false'"
          type="textarea"
          v-model="newQuestionnaire.ageWarningMessage"
          name="ageWarningMessage"
          label="Age warning message"
          help="Leave blank to use the default message. You can use {range} and {age} placeholders."
          placeholder="e.g. This screening is intended for children aged {range}. This child is currently {age} old. You may still continue."
          rows="3"
        />

        <!-- Custom Footer -->
        <div class="flex justify-end gap-2 mt-4">
          <button
            type="button"
            class="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 text-black"
            @click="showQuestionnaireModal = false"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
          >
            Save
          </button>
        </div>
      </FormKit>
    </rs-modal>

    <!-- Toggle confirmation modal -->
    <rs-modal
      title="Confirmation"
      ok-title="Yes"
      cancel-title="No"
      :ok-callback="performToggleStatus"
      :cancel-callback="cancelToggleStatus"
      v-model="showConfirmToggleModal"
      :overlay-close="false"
    >
      <p>
        Are you sure you want to
        <span v-if="pendingToggleQuestionnaire?.status === 'Active'">deactivate</span>
        <span v-else>activate</span>
        this autism screening ({{ pendingToggleQuestionnaire?.name }})?
      </p>

      <div v-if="isTogglingStatus" class="flex justify-center items-center mt-4 p-2 bg-blue-50 rounded-md">
        <Icon name="line-md:loading-twotone-loop" class="text-primary mr-2" />
        <span>Updating status...</span>
      </div>
    </rs-modal>

    <!-- M-CHAT-R age limit change confirmation -->
    <rs-modal
      title="Update M-CHAT-R Age Limit"
      ok-title="Yes, update access"
      cancel-title="Cancel"
      :ok-callback="confirmAgeLimitChange"
      :cancel-callback="cancelAgeLimitChange"
      v-model="showConfirmAgeLimitModal"
      :overlay-close="false"
    >
      <p class="mb-4">
        You are changing the M-CHAT-R age limit. Access will be updated automatically:
      </p>
      <ul class="list-disc ml-5 mb-4 text-sm space-y-1">
        <li>
          Children now <span class="font-semibold text-red-600">outside</span> the range → M-CHAT-R
          <span class="font-semibold text-red-600">disabled</span>
        </li>
        <li>
          Children now <span class="font-semibold text-green-600">inside</span> the range → M-CHAT-R
          <span class="font-semibold text-green-600">unlocked</span>
        </li>
      </ul>
      <div class="bg-orange-50 border-l-4 border-orange-500 p-4 mb-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <Icon name="material-symbols:warning" class="text-orange-500" />
          </div>
          <div class="ml-3">
            <p class="text-sm text-orange-800">
              Admins can still override M-CHAT-R for individual children later, with a confirmation warning when unlocking outside the age range.
              Other screenings are not auto-locked by age — parents only get a warning.
            </p>
          </div>
        </div>
      </div>
      <div v-if="isSavingAgeLimitChange" class="flex justify-center items-center mt-4 p-2 bg-blue-50 rounded-md">
        <Icon name="line-md:loading-twotone-loop" class="text-primary mr-2" />
        <span>Updating age limits and syncing child access...</span>
      </div>
    </rs-modal>

    <!-- Delete confirmation modal -->
    <rs-modal
      title="Delete Autism Screening"
      ok-title="Delete"
      cancel-title="Cancel"
      :ok-callback="performDelete"
      :cancel-callback="cancelDelete"
      v-model="showDeleteModal"
      :overlay-close="false"
    >
      <p class="mb-4">
        Are you sure you want to delete this autism screening ({{ pendingDeleteQuestionnaire?.name }})?
      </p>
      <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <Icon name="material-symbols:warning" class="text-yellow-400" />
          </div>
          <div class="ml-3">
            <p class="text-sm text-yellow-700">
              This will also delete all associated questions, options, and responses. This action cannot be undone.
            </p>
          </div>
        </div>
      </div>

      <div v-if="isDeleting" class="flex justify-center items-center mt-4 p-2 bg-blue-50 rounded-md">
        <Icon name="line-md:loading-twotone-loop" class="text-primary mr-2" />
        <span>Deleting...</span>
      </div>
    </rs-modal>
  </div>
</template>
