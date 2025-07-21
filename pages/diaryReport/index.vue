<script setup>
import { ref, onMounted, computed } from 'vue';

// Data
const isLoading = ref(true);
const patients = ref([]);
const message = ref('');
const messageType = ref('success');
const isGenerating = ref({});
const searchQuery = ref('');

// Fetch all patients with their parent information
async function fetchPatients() {
  isLoading.value = true;
  try {
    const response = await fetch('/api/parents/manageChild/listChild');
    const result = await response.json();
    
    if (result.statusCode === 200 && result.data) {
      // Get parent details to fetch full names
      const parentsResponse = await fetch('/api/parents/listParents');
      const parentsResult = await parentsResponse.json();
      
      if (parentsResult.statusCode === 200 && parentsResult.data) {
        const parentsMap = {};
        parentsResult.data.forEach(parent => {
          parentsMap[parent.parentID] = parent.fullName;
        });
        
        // Merge parent full names into patient data
        patients.value = result.data.map(patient => ({
          ...patient,
          parentFullName: parentsMap[patient.parentID] || patient.parentUsername
        }));
      } else {
        patients.value = result.data;
      }
    } else {
      showMessage('Failed to load patients data', 'error');
    }
  } catch (error) {
    console.error('Error fetching patients:', error);
    showMessage('Error loading patients data', 'error');
  } finally {
    isLoading.value = false;
  }
}

// Show message helper
function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => {
    message.value = '';
  }, 3000);
}

// Generate report for the selected patient
async function generateReport(patientId) {
  if (!patientId) {
    showMessage('Cannot identify patient', 'error');
    return;
  }
  
  isGenerating.value = {...isGenerating.value, [patientId]: true};
  try {
    // Here you would implement the actual report generation logic
    // For now, we'll just simulate it with a timeout
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    showMessage('Report generated successfully', 'success');
  } catch (error) {
    console.error('Error generating report:', error);
    showMessage('Error generating report', 'error');
  } finally {
    isGenerating.value = {...isGenerating.value, [patientId]: false};
  }
}

// Filter patients based on search query
const filteredPatients = computed(() => {
  if (!searchQuery.value) return patients.value;
  
  const query = searchQuery.value.toLowerCase();
  return patients.value.filter(patient => 
    patient.fullname?.toLowerCase().includes(query) || 
    patient.parentFullName?.toLowerCase().includes(query) ||
    patient.icNumber?.toLowerCase().includes(query) ||
    (patient.autismDiagnose && patient.autismDiagnose.toLowerCase().includes(query))
  );
});

// Format date helper
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString();
}

// Load data on component mount
onMounted(fetchPatients);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Patient Diary Reports</h1>
    </div>

    <!-- Message display -->
    <div v-if="message" class="mb-4 p-3 rounded text-white"
      :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
      {{ message }}
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex justify-center my-8">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>

    <div v-else>
      <!-- Search and filters -->
      <div class="mb-4">
        <div class="flex gap-4">
          <div class="flex-1">
            <FormKit
              type="text"
              v-model="searchQuery"
              placeholder="Search by patient name, IC, parent name, or diagnosis"
              prefix-icon="search"
            />
          </div>
        </div>
      </div>

      <!-- Patients table -->
      <div class="card p-0 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Parent Name
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient Name
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IC Number
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Diagnosis
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Diagnosed Date
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-if="filteredPatients.length === 0">
                <td colspan="7" class="px-6 py-4 text-center text-gray-500">
                  No patients found. Please adjust your search criteria.
                </td>
              </tr>
              <tr v-for="patient in filteredPatients" :key="patient.childID" class="hover:bg-gray-50">
                <td class="px-6 py-4">
                  <div class="text-sm text-gray-900">{{ patient.parentFullName || patient.parentUsername }}</div>
                </td>
                <td class="px-6 py-4">
                  <div class="text-sm font-medium text-gray-900">{{ patient.fullname }}</div>
                </td>
                <td class="px-6 py-4">
                  <div class="text-sm text-gray-900">{{ patient.icNumber || 'N/A' }}</div>
                </td>
                <td class="px-6 py-4">
                  <div class="text-sm text-gray-900">{{ patient.autismDiagnose || 'Not diagnosed' }}</div>
                </td>
                <td class="px-6 py-4">
                  <div class="text-sm text-gray-900">{{ formatDate(patient.diagnosedDate) }}</div>
                </td>
                <td class="px-6 py-4">
                  <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full"
                        :class="patient.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'">
                    {{ patient.status }}
                  </span>
                </td>
                <td class="px-6 py-4 text-right whitespace-nowrap">
                  <div class="flex justify-end space-x-2">
                    <rs-button 
                      @click="$router.push(`/diaryReport/view/${patient.childID}`)" 
                      color="primary"
                      size="sm"
                    >
                      <Icon name="material-symbols:visibility" class="mr-1" />
                      View
                    </rs-button>
                    <rs-button 
                      @click="$router.push(`/patientProfile?patientId=${patient.childID}`)" 
                      color="secondary"
                      size="sm"
                    >
                      <Icon name="material-symbols:person" class="mr-1" />
                      Profile
                    </rs-button>
                    <!-- <rs-button 
                      @click="generateReport(patient.childID)" 
                      :loading="isGenerating[patient.childID]"
                      color="success"
                      size="sm"
                    >
                      <Icon name="material-symbols:description" class="mr-1" />
                      Generate
                    </rs-button> -->
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
  overflow: hidden;
}
</style>