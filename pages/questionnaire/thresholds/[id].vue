<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const questionnaireId = route.params.id;

const questionnaire = ref(null);
const thresholds = ref([]);
const isLoading = ref(true);
const errorMessage = ref('');
const successMessage = ref('');
const showThresholdModal = ref(false);
const isEditingThreshold = ref(false);
const editThresholdId = ref(null);
const modalErrorMessage = ref('');

const newThreshold = ref({
  scoring_min: '',
  scoring_max: '',
  interpretation: '',
  recommendation: ''
});

onMounted(async () => {
  await fetchQuestionnaireData();
  await fetchThresholds();
});

async function fetchQuestionnaireData() {
  isLoading.value = true;
  try {
    const res = await fetch(`/api/questionnaire/listQuestionnaires?questionnaireID=${questionnaireId}`);
    const result = await res.json();

    if (res.ok && result.data && result.data.length > 0) {
      questionnaire.value = result.data[0];
    } else {
      errorMessage.value = 'Autism screening not found';
              console.error('Autism screening not found. API response:', result);
    }
  } catch (err) {
          console.error('Error loading autism screening:', err);
          errorMessage.value = 'Error loading autism screening';
  } finally {
    isLoading.value = false;
  }
}

async function fetchThresholds() {
  isLoading.value = true;
  try {
    const res = await fetch(`/api/questionnaire/thresholds?questionnaireId=${questionnaireId}`);
    const result = await res.json();

    console.log('Thresholds API response:', result);

    if (res.ok && result.data) {
      thresholds.value = result.data;
    } else {
      console.error('Failed to load thresholds:', result.message);
    }
  } catch (err) {
    console.error('Error loading thresholds:', err);
  } finally {
    isLoading.value = false;
  }
}

function openAddThresholdModal() {
  newThreshold.value = {
    scoring_min: '',
    scoring_max: '',
    interpretation: '',
    recommendation: ''
  };
  isEditingThreshold.value = false;
  editThresholdId.value = null;
  showThresholdModal.value = true;
}

function openEditThresholdModal(threshold) {
  newThreshold.value = {
    scoring_min: threshold.scoring_min,
    scoring_max: threshold.scoring_max === 999999 ? '' : threshold.scoring_max,
    interpretation: threshold.interpretation,
    recommendation: threshold.recommendation
  };
  isEditingThreshold.value = true;
  editThresholdId.value = threshold.threshold_id;
  showThresholdModal.value = true;
}

async function saveThreshold() {
  if (!newThreshold.value.scoring_min || 
      !newThreshold.value.interpretation || 
      !newThreshold.value.recommendation) {
    modalErrorMessage.value = 'Minimum score, prediction, and recommendation are required';
    return;
  }

  try {
    const min = parseInt(newThreshold.value.scoring_min);
    const max = newThreshold.value.scoring_max ? parseInt(newThreshold.value.scoring_max) : 999999;
    
    if (min > max) {
      modalErrorMessage.value = 'Minimum score cannot be greater than maximum score';
      return;
    }

    const payload = {
      questionnaire_id: parseInt(questionnaireId),
      scoring_min: min,
      scoring_max: max,
      interpretation: newThreshold.value.interpretation,
      recommendation: newThreshold.value.recommendation
    };

    if (isEditingThreshold.value && editThresholdId.value) {
      payload.threshold_id = editThresholdId.value;
    }

    console.log('Sending payload:', payload);

    const res = await fetch('/api/questionnaire/thresholds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    console.log('Response:', result);

    if (res.ok) {
      showThresholdModal.value = false;
      modalErrorMessage.value = '';
      successMessage.value = `Threshold ${isEditingThreshold.value ? 'updated' : 'created'} successfully`;
      setTimeout(() => {
        successMessage.value = '';
      }, 3000);
      await fetchThresholds();
    } else {
      modalErrorMessage.value = result.message || `Failed to ${isEditingThreshold.value ? 'update' : 'create'} threshold`;
    }
  } catch (err) {
    console.error(`Error ${isEditingThreshold.value ? 'updating' : 'creating'} threshold:`, err);
    modalErrorMessage.value = 'An unexpected error occurred';
  }
}

async function deleteThreshold(thresholdId) {
  if (!confirm('Are you sure you want to delete this threshold?')) return;

  try {
    const res = await fetch(`/api/questionnaire/thresholds?threshold_id=${thresholdId}`, {
      method: 'DELETE'
    });

    const result = await res.json();

    if (res.ok) {
      successMessage.value = 'Threshold deleted successfully';
      setTimeout(() => {
        successMessage.value = '';
      }, 3000);
      await fetchThresholds();
    } else {
      errorMessage.value = result.message || 'Failed to delete threshold';
      setTimeout(() => {
        errorMessage.value = '';
      }, 3000);
    }
  } catch (err) {
    console.error('Error deleting threshold:', err);
    errorMessage.value = 'An error occurred while deleting the threshold';
    setTimeout(() => {
      errorMessage.value = '';
    }, 3000);
  }
}

function goBack() {
  router.push('/questionnaire');
}

function getScoreRangeDisplay(threshold) {
  if (threshold.scoring_min === threshold.scoring_max) {
    return `Score = ${threshold.scoring_min}`;
  } else if (threshold.scoring_min === 0) {
    return `Score ≤ ${threshold.scoring_max}`;
  } else if (threshold.scoring_max === 999999) {
    return `Score ≥ ${threshold.scoring_min}`;
  } else {
    return `${threshold.scoring_min} - ${threshold.scoring_max}`;
  }
}
</script>

<template>
  <div>
    <div class="flex items-center mb-4">
      <button @click="goBack" class="mr-2 p-2 rounded hover:bg-gray-100">
        <Icon name="material-symbols:arrow-back" />
      </button>
      <h1 class="text-2xl font-bold">Scoring Thresholds Management</h1>
    </div>

    <div v-if="successMessage" class="mb-4 p-3 rounded bg-green-100 text-green-700 border border-green-300">
      {{ successMessage }}
    </div>

    <div v-if="errorMessage" class="mb-4 p-3 rounded bg-red-100 text-red-700 border border-red-300">
      {{ errorMessage }}
    </div>

    <div v-if="isLoading" class="flex justify-center my-8">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>

    <div v-else-if="questionnaire">
      <div class="card mb-6 p-4">
        <h2 class="text-xl font-semibold">{{ questionnaire.title }}</h2>
        <p class="text-sm text-gray-500">{{ questionnaire.description }}</p>
      </div>

      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold">Scoring Thresholds</h3>
        <rs-button @click="openAddThresholdModal">
          <Icon name="material-symbols:add" class="mr-1" />
          Add Threshold
        </rs-button>
      </div>

      <div class="card p-4 overflow-x-auto">
        <div v-if="thresholds.length === 0" class="text-center py-8">
          <div class="flex flex-col items-center">
            <Icon name="material-symbols:format-list-bulleted-add" size="64" class="text-gray-400 mb-4" />
            <h3 class="text-xl font-medium text-gray-600 mb-2">No Thresholds Defined Yet</h3>
            <p class="text-gray-500 mb-6">Define scoring thresholds to provide predictions and recommendations based on autism screening scores.</p>
            <div class="flex gap-4">
              <rs-button @click="openAddThresholdModal">
                <Icon name="material-symbols:add" class="mr-1" />
                Add Threshold
              </rs-button>
            </div>
          </div>
        </div>
        <div v-else class="overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score Range
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prediction
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recommendation
                </th>
                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="threshold in thresholds" :key="threshold.threshold_id">
                <td class="px-6 py-4">
                  <div class="text-sm font-medium">{{ getScoreRangeDisplay(threshold) }}</div>
                </td>
                <td class="px-6 py-4">
                  <div class="text-sm">{{ threshold.interpretation }}</div>
                </td>
                <td class="px-6 py-4">
                  <div class="text-sm">{{ threshold.recommendation }}</div>
                </td>
                <td class="px-6 py-4 text-right text-sm font-medium">
                  <div class="flex justify-end gap-3 items-center">
                    <button 
                      @click="openEditThresholdModal(threshold)" 
                      class="text-indigo-600 hover:text-indigo-900"
                      title="Edit Threshold"
                    >
                      <Icon name="material-symbols:edit-outline-rounded" size="20" />
                    </button>
                    
                    <button 
                      @click="deleteThreshold(threshold.threshold_id)" 
                      class="text-red-600 hover:text-red-900"
                      title="Delete Threshold"
                    >
                      <Icon name="material-symbols:delete-outline" size="20" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <div v-else class="text-center py-12">
      <div class="flex flex-col items-center">
        <Icon name="material-symbols:error-outline" size="64" class="text-gray-400 mb-4" />
        <h3 class="text-xl font-medium text-gray-600 mb-2">Autism Screening Not Found</h3>
        <p class="text-gray-500">The requested autism screening could not be found.</p>
      </div>
    </div>

    <!-- Threshold Modal -->
    <rs-modal
      :title="isEditingThreshold ? 'Edit Threshold' : 'Add Threshold'"
      v-model="showThresholdModal"
      :overlay-close="false"
      :hide-footer="true"
    >
      <div v-if="modalErrorMessage" class="mb-3 p-2 rounded bg-red-100 text-red-700 border border-red-300">
        {{ modalErrorMessage }}
      </div>

      <FormKit type="form" @submit="saveThreshold" :actions="false">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormKit
            type="number"
            v-model="newThreshold.scoring_min"
            name="scoringMin"
            label="Minimum Score"
            placeholder="Enter minimum score"
            validation="required|number"
            validation-visibility="dirty"
            :validation-messages="{ required: 'This field is required', number: 'Must be a number' }"
          />

          <FormKit
            type="number"
            v-model="newThreshold.scoring_max"
            name="scoringMax"
            label="Maximum Score (leave empty for no upper limit)"
            placeholder="Enter maximum score"
            validation="number"
            validation-visibility="dirty"
            :validation-messages="{ number: 'Must be a number' }"
          />
        </div>

        <FormKit
          type="textarea"
          v-model="newThreshold.interpretation"
          name="interpretation"
          label="Prediction"
          placeholder="Enter prediction for this score range"
          validation="required"
          validation-visibility="dirty"
          :validation-messages="{ required: 'This field is required' }"
          rows="3"
        />

        <FormKit
          type="textarea"
          v-model="newThreshold.recommendation"
          name="recommendation"
          label="Recommendation"
          placeholder="Enter recommendation for this score range"
          validation="required"
          validation-visibility="dirty"
          :validation-messages="{ required: 'This field is required' }"
          rows="3"
        />

        <div class="flex justify-end gap-2 mt-4">
          <button
            type="button"
            class="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 text-black"
            @click="showThresholdModal = false"
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
  </div>
</template> 