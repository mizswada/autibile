<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const questionId = route.params.id;

const question = ref(null);
const options = ref([]);
const isLoading = ref(true);
const showOptionModal = ref(false);
const newOption = ref({
  option_title: '',
  option_value: 0,
  order_number: null,
  option_type: 'radio' // This is just for UI, not stored directly in DB
});
const isEditingOption = ref(false);
const editOptionId = ref(null);
const message = ref('');
const messageType = ref('success');
const modalErrorMessage = ref('');

// Define available option types
const optionTypes = [
  { value: 'radio', label: 'Radio Button (Single Select)' },
  { value: 'checkbox', label: 'Checkbox (Multiple Select)' },
  { value: 'scale', label: 'Scale (1-5)' },
  { value: 'text', label: 'Text Input' },
  { value: 'textarea', label: 'Text Area' }
];

// Function to get option type label
function getOptionTypeLabel(type) {
  const types = {
    'radio': 'Radio Button',
    'checkbox': 'Checkbox',
    'scale': 'Scale',
    'text': 'Text Input',
    'textarea': 'Text Area'
  };
  
  return types[type] || type;
}

// Function to extract option type from title
function extractOptionType(optionTitle) {
  if (!optionTitle) return 'radio';
  
  if (optionTitle.startsWith('[radio]')) return 'radio';
  if (optionTitle.startsWith('[checkbox]')) return 'checkbox';
  if (optionTitle.startsWith('[scale]')) return 'scale';
  if (optionTitle.startsWith('[text]')) return 'text';
  if (optionTitle.startsWith('[textarea]')) return 'textarea';
  
  return 'radio'; // Default
}

// Function to clean option title (remove type prefix)
function cleanOptionTitle(optionTitle) {
  if (!optionTitle) return '';
  
  return optionTitle
    .replace(/^\[(radio|checkbox|scale|text|textarea)\]/, '')
    .trim();
}

// Function to add type prefix to option title
function addTypePrefix(title, type) {
  const cleanTitle = cleanOptionTitle(title);
  return `[${type}]${cleanTitle}`;
}

function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => {
    message.value = '';
  }, 3000);
}

// Function to get answer type label
function getAnswerTypeLabel(answerTypeId) {
  if (!answerTypeId) return 'N/A';
  
  const answerTypes = {
    33: 'Text Type',
    34: 'Range Type',
    35: 'Option Type'
  };
  
  return answerTypes[answerTypeId] || `Type ID: ${answerTypeId}`;
}

onMounted(async () => {
  await fetchQuestionData();
  await fetchOptions();
});

async function fetchQuestionData() {
  isLoading.value = true;
  try {
    // First, get the questionnaire ID from the question
    const res = await fetch(`/api/questionnaire/questions/listQuestions?questionID=${questionId}`);
    const result = await res.json();

    if (res.ok && result.data && result.data.length > 0) {
      question.value = {
        ...result.data[0],
        // Make sure we have answer_type available
        answer_type: result.data[0].answer_type || null
      };
    } else {
      showMessage('Question not found', 'error');
      router.push('/questionnaire');
    }
  } catch (err) {
    console.error('Error loading question data:', err);
    showMessage('Error loading question data', 'error');
  } finally {
    isLoading.value = false;
  }
}

async function fetchOptions() {
  isLoading.value = true;
  try {
    const res = await fetch(`/api/questionnaire/questions/options/list?questionID=${questionId}`, {
      // Add cache control to prevent browser caching
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    const result = await res.json();

    if (res.ok && result.data) {
      options.value = result.data.map(option => ({
        id: option.option_id,
        title: option.option_title, // Store the full title with prefix
        value: option.option_value,
        order: option.order_number,
        type: extractOptionType(option.option_title)
      }));
    } else {
      console.error('Failed to load options:', result.message);
    }
  } catch (err) {
    console.error('Error loading options:', err);
  } finally {
    isLoading.value = false;
  }
}

// Open modal for adding a new option
function openAddOptionModal() {
  if (question.value.answer_type !== 35) {
    alert('Options can only be added for Option Type questions.');
    return;
  }
  isEditingOption.value = false;
  newOption.value = {
    option_type: 'radio',
    option_title: '',
    option_value: '',
    order_number: options.length + 1
  };
  showOptionModal.value = true;
}

function openEditOptionModal(option) {
  if (question.value.answer_type !== 35) {
    alert('Options can only be edited for Option Type questions.');
    return;
  }
  isEditingOption.value = true;
  newOption.value = {
    id: option.id,
    option_type: getOptionType(option.title),
    option_title: getCleanTitle(option.title),
    option_value: option.value,
    order_number: option.order
  };
  showOptionModal.value = true;
}


// // Open modal for editing an existing option
// function openEditOptionModal(option) {
//   isEditingOption.value = true;
//   newOption.value = {
//     id: option.id,
//     option_type: getOptionType(option.title),
//     option_title: getCleanTitle(option.title),
//     option_value: option.value,
//     order_number: option.order
//   };
//   showOptionModal.value = true;
// }

// Save option (create or update)
async function saveOption() {
  try {
    if (!newOption.value.option_title) {
      alert('Option title is required');
      return;
    }

    // Add the type prefix to the title
    const formattedTitle = addTypePrefix(newOption.value.option_title, newOption.value.option_type);
    
    const payload = {
      question_id: questionId,
      option_title: formattedTitle,
      option_value: newOption.value.option_value,
      order_number: newOption.value.order_number
    };

    let response;
    if (isEditingOption.value && newOption.value.id) {
      response = await fetch('/api/questionnaire/questions/options/update.put', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          option_id: newOption.value.id,
          ...payload
        })
      });
    } else {
      response = await fetch('/api/questionnaire/questions/options/insert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    }

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'API request failed');
    }

    // First close the modal
    showOptionModal.value = false;
    
    // Then restore scrolling and show message
    setTimeout(() => {
      // Force restore scrolling
      document.body.style.overflow = 'auto';
      document.body.style.position = '';
      document.documentElement.style.overflow = 'auto';
      
      // Show success message
      showMessage(isEditingOption.value ? 'Option updated successfully' : 'Option added successfully', 'success');
      
      // Fetch options after a short delay to ensure UI is responsive
      setTimeout(() => {
        fetchOptions();
      }, 100);
    }, 200);
  } catch (error) {
    console.error('Error saving option:', error);
    alert(`Failed to save option: ${error.message}`);
  }
}

async function deleteOption(optionId) {
  const confirmDelete = confirm('Are you sure you want to delete this option?');
  if (!confirmDelete) return;

  try {
    const res = await fetch(`/api/questionnaire/questions/options/delete?optionID=${optionId}`, {
      method: 'DELETE'
    });
    
    const result = await res.json();

    if (res.ok) {
      showMessage('Option deleted successfully', 'success');
      await fetchOptions();
    } else {
      showMessage(result.message || 'Failed to delete option', 'error');
    }
  } catch (err) {
    console.error('Delete error:', err);
    showMessage('Internal server error', 'error');
  }
}

function goBack() {
  router.push(`/questionnaire/questions/${question.value?.questionnaire_id}`);
}

// Function to generate range options (1-5)
async function generateRangeOptions() {
  try {
    // First check if range options already exist
    const existingRangeOptions = options.value.filter(o => o.title.includes('[radio]') && /^[1-5]$/.test(o.value));
    
    if (existingRangeOptions.length === 5) {
      alert('Range options (1-5) already exist for this question.');
      return;
    }
    
    // Delete any existing range options if they don't match exactly what we want
    if (existingRangeOptions.length > 0) {
      const confirmDelete = confirm('Some range options already exist. Do you want to replace them?');
      if (!confirmDelete) return;
      
      for (const option of existingRangeOptions) {
        await deleteOption(option.id);
      }
    }
    
    // Generate 5 radio options for the scale
    const rangeLabels = {
      1: 'Strongly Disagree',
      2: 'Disagree',
      3: 'Neutral',
      4: 'Agree',
      5: 'Strongly Agree'
    };
    
    for (let i = 1; i <= 5; i++) {
      await fetch('/api/questionnaire/questions/options/insert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question_id: questionId,
          option_title: `[radio] ${i} - ${rangeLabels[i]}`,
          option_value: i.toString(),
          order_number: i
        })
      });
    }
    
    // Refresh options
    await fetchOptions();
    alert('Range options (1-5) have been generated successfully.');
  } catch (error) {
    console.error('Error generating range options:', error);
    alert('Failed to generate range options. Please try again.');
  }
}


// Function to get option type from title
function getOptionType(title) {
  if (!title) return 'radio'; // Default type
  
  if (title.startsWith('[radio]')) return 'radio';
  if (title.startsWith('[checkbox]')) return 'checkbox';
  if (title.startsWith('[scale]')) return 'scale';
  if (title.startsWith('[text]')) return 'text';
  if (title.startsWith('[textarea]')) return 'textarea';
  
  return 'radio'; // Default type
}

// Function to get clean title without type prefix
function getCleanTitle(title) {
  if (!title) return '';
  
  return title
    .replace(/^\[(radio|checkbox|scale|text|textarea)\]\s*/, '')
    .trim();
}

function confirmDeleteOption(optionId) {
  const confirmDelete = confirm('Are you sure you want to delete this option?');
  if (confirmDelete) {
    deleteOption(optionId);
  }
}

// Watch for modal closing to ensure scroll is restored
watch(showOptionModal, (newVal) => {
  if (!newVal) {
    // Modal is closing, ensure scroll is enabled
    setTimeout(() => {
      document.body.style.overflow = 'auto';
      document.body.style.position = 'static';
      document.documentElement.style.overflow = 'auto';
    }, 100);
  }
});
</script>

<style>
.formkit-label::after {
  content: '*';
  color: red;
  margin-left: 4px;
}
</style>
<template>
  <div>
    <!-- Header -->
    <div class="flex items-center mb-4">
      <button @click="goBack" class="mr-2 p-2 rounded hover:bg-gray-100">
        <Icon name="material-symbols:arrow-back" />
      </button>
      <h1 class="text-2xl font-bold">Question Answer Management</h1>
    </div>

    <!-- Message -->
    <div v-if="message" class="mb-4 p-3 rounded text-white" :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
      {{ message }}
    </div>

    <!-- Loading Spinner -->
    <div v-if="isLoading" class="flex justify-center my-8">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>

    <!-- Question Details -->
    <div v-else-if="question">
      <!-- Question Details Card -->
      <div class="card mb-6 p-6 bg-white shadow-sm rounded-lg">
        <div class="flex items-center mb-4">
          <div class="bg-blue-100 p-2 rounded-full mr-3">
            <Icon name="material-symbols:help-outline" class="text-blue-600" size="24" />
          </div>
          <h2 class="text-xl font-semibold">Question Details</h2>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-gray-50 p-4 rounded-lg">
            <h3 class="text-sm uppercase text-gray-500 mb-1">Bahasa Malaysia</h3>
            <p class="text-lg font-medium">{{ question.question_text_bm }}</p>
          </div>
          <div class="bg-gray-50 p-4 rounded-lg">
            <h3 class="text-sm uppercase text-gray-500 mb-1">English</h3>
            <p class="text-lg font-medium">{{ question.question_text_bi }}</p>
          </div>
        </div>

        <div class="flex mt-4 space-x-4">
          <div class="flex items-center">
            <span class="inline-flex items-center justify-center w-6 h-6 rounded-full mr-2"
              :class="question.is_required ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'">
              <Icon :name="question.is_required ? 'material-symbols:check' : 'material-symbols:close'" size="16" />
            </span>
            <span class="text-sm">
              <span class="font-medium">Required:</span> {{ question.is_required ? 'Yes' : 'No' }}
            </span>
          </div>

          <div class="flex items-center">
            <span class="inline-flex items-center justify-center w-6 h-6 rounded-full mr-2"
              :class="question.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'">
              <Icon :name="question.status === 'Active' ? 'material-symbols:check' : 'material-symbols:close'" size="16" />
            </span>
            <span class="text-sm">
              <span class="font-medium">Status:</span> {{ question.status }}
            </span>
          </div>

          <div v-if="question.answer_type" class="flex items-center">
            <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-800 mr-2">
              <Icon name="material-symbols:category" size="16" />
            </span>
            <span class="text-sm">
              <span class="font-medium">Answer Type:</span> {{ getAnswerTypeLabel(question.answer_type) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Answer Configuration -->
      <div v-if="question.answer_type" class="card mb-6 p-6 bg-white shadow-sm rounded-lg">
        <div class="flex items-center mb-4">
          <div class="bg-purple-100 p-2 rounded-full mr-3">
            <Icon name="material-symbols:settings" class="text-purple-600" size="24" />
          </div>
          <h2 class="text-xl font-semibold">Answer Configuration</h2>
        </div>

        <!-- Text Type -->
        <div v-if="question.answer_type === 33" class="bg-gray-50 p-4 rounded-lg">
          <h3 class="font-medium mb-2">Text Input Configuration</h3>
          <p class="text-gray-600 mb-4">This question will be answered with a text input field. No additional options are needed.</p>
          <div class="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <div class="flex items-center">
              <Icon name="material-symbols:info-outline" class="text-blue-600 mr-2" size="20" />
              <p class="text-blue-800 text-sm">Text inputs don't require options. The system will automatically create a text field for this question.</p>
            </div>
          </div>
        </div>

        <!-- Range Type -->
        <div v-else-if="question.answer_type === 34" class="bg-gray-50 p-4 rounded-lg">
          <h3 class="font-medium mb-2">Range Input Configuration</h3>
          <p class="text-gray-600 mb-4">This question will be answered with a scale from 1 to 5.</p>
          <!-- <div class="mb-4">
            <rs-button @click="generateRangeOptions" class="w-full">
              <Icon name="material-symbols:add" class="mr-1" />
              Generate Scale Options (1-5)
            </rs-button>
          </div> -->
          <div class="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <div class="flex items-center">
              <Icon name="material-symbols:info-outline" class="text-blue-600 mr-2" size="20" />
              <p class="text-blue-800 text-sm">Automatically generate a 1-5 scale for this question.</p>
            </div>
          </div>
        </div>

        <!-- Option Type -->
        <div v-else-if="question.answer_type === 35" class="bg-gray-50 p-4 rounded-lg">
          <h3 class="font-medium mb-2">Multiple Choice Configuration</h3>
          <p class="text-gray-600 mb-4">This question will be answered with multiple choice options. Add options below.</p>

          <!-- Options Header -->
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">Options ({{ options.length }})</h3>
            <div class="flex gap-2">
              <rs-button @click="fetchOptions" variant="outline" title="Refresh Options" :disabled="isLoading">
                <Icon v-if="isLoading" name="material-symbols:refresh" class="mr-1 animate-spin" />
                <Icon v-else name="material-symbols:refresh" class="mr-1" />
                Refresh
              </rs-button>
              <rs-button @click="openAddOptionModal">
                <Icon name="material-symbols:add" class="mr-1" /> Add Option
              </rs-button>
            </div>
          </div>

          <!-- Options List -->
          <div class="card p-4">
            <div v-if="options.length === 0" class="text-center py-8">
              <div class="flex flex-col items-center">
                <Icon name="material-symbols:format-list-bulleted-add" size="64" class="text-gray-400 mb-4" />
                <h3 class="text-xl font-medium text-gray-600 mb-2">No Options Added Yet</h3>
                <p class="text-gray-500 mb-6">This question doesn't have any answer options yet. You need to add at least one option for the question to be answerable.</p>
                <rs-button size="lg" @click="openAddOptionModal">
                  <Icon name="material-symbols:add" class="mr-1" /> Add First Option
                </rs-button>
              </div>
            </div>

            <table v-else class="min-w-full">
              <thead class="bg-gray-100">
                <tr>
                  <th class="px-4 py-2 text-left">Order</th>
                  <th class="px-4 py-2 text-left">Option Title</th>
                  <th class="px-4 py-2 text-left">Type</th>
                  <th class="px-4 py-2 text-left">Value/Score</th>
                  <th class="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="option in options" :key="option.id" class="border-t hover:bg-gray-50">
                  <td class="px-4 py-2">
                    <span class="inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {{ option.order || '-' }}
                    </span>
                  </td>
                  <td class="px-4 py-2">{{ getCleanTitle(option.title) }}</td>
                  <td class="px-4 py-2">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      :class="{
                        'bg-blue-100 text-blue-800': getOptionType(option.title) === 'radio',
                        'bg-purple-100 text-purple-800': getOptionType(option.title) === 'checkbox',
                        'bg-green-100 text-green-800': getOptionType(option.title) === 'scale',
                        'bg-yellow-100 text-yellow-800': ['text', 'textarea'].includes(getOptionType(option.title))
                      }">
                      {{ getOptionTypeLabel(getOptionType(option.title)) }}
                    </span>
                  </td>
                  <td class="px-4 py-2">
                    <span :class="option.value > 0 ? 'text-green-600 font-medium' : 'text-gray-500'">
                      {{ option.value }}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-right">
                    <button @click="openEditOptionModal(option)"
                      class="inline-flex items-center justify-center p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full mr-1"
                      title="Edit Option">
                      <Icon name="material-symbols:edit-outline-rounded" size="18" />
                    </button>
                    <button @click="confirmDeleteOption(option.id)"
                      class="inline-flex items-center justify-center p-1.5 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full"
                      title="Delete Option">
                      <Icon name="material-symbols:delete-outline" size="18" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Add/Edit Option Modal -->
          <rs-modal 
            v-model="showOptionModal" 
            :title="isEditingOption ? 'Edit Option' : 'Add Option'"
            @close="document.body.style.overflow = 'auto'; document.body.style.position = 'static';"
          >
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Option Type</label>
                <select v-model="newOption.option_type" class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                  <option value="radio">Radio Button (Single Choice)</option>
                  <option value="checkbox">Checkbox (Multiple Choice)</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Option Title</label>
                <input v-model="newOption.option_title" type="text" class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Enter option title" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Value/Score</label>
                <input v-model="newOption.option_value" type="text" class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Enter value or score" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                <input v-model="newOption.order_number" type="number" min="1" class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Enter display order" />
              </div>
            </div>

            <template #footer>
              <div class="flex justify-end space-x-2">
                <rs-button @click="showOptionModal = false; document.body.style.overflow = 'auto';" variant="outline">Cancel</rs-button>
                <rs-button @click="saveOption" variant="primary">Save</rs-button>
              </div>
            </template>
          </rs-modal>
        </div>
      </div>

      <!-- Debug Section
      <div class="mt-6 p-3 border border-gray-200 rounded bg-gray-50">
        <h4 class="font-bold mb-2">Debug Information</h4>
        <div class="mb-3">
          <h5 class="font-semibold">Question ID: {{ questionId }}</h5>
          <pre class="text-xs overflow-auto max-h-40">{{ JSON.stringify(question, null, 2) }}</pre>
        </div>
        <div>
          <h5 class="font-semibold">Options:</h5>
          <pre class="text-xs overflow-auto max-h-40">{{ JSON.stringify(options, null, 2) }}</pre>
        </div>
      </div> -->
    </div>
  </div>
</template>

