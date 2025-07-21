<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

// Data
const patients = ref([]);
const isLoading = ref(true);
const searchQuery = ref('');
const selectedParent = ref('');
const parents = ref([]);

// Computed
const filteredPatients = computed(() => {
  let filtered = patients.value;
  
  if (searchQuery.value) {
    filtered = filtered.filter(patient => 
      patient.fullname?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      patient.nickname?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      patient.icNumber?.includes(searchQuery.value)
    );
  }
  
  if (selectedParent.value) {
    filtered = filtered.filter(patient => patient.parentID === parseInt(selectedParent.value));
  }
  
  return filtered;
});

onMounted(async () => {
  await Promise.all([
    fetchPatients(),
    fetchParents()
  ]);
});

async function fetchPatients() {
  isLoading.value = true;
  try {
    const response = await fetch('/api/parents/manageChild/listChild');
    const result = await response.json();
    
    if (result.statusCode === 200 && result.data) {
      patients.value = result.data;
    } else {
      console.error('Failed to fetch patients:', result.message);
    }
  } catch (error) {
    console.error('Error fetching patients:', error);
  } finally {
    isLoading.value = false;
  }
}

async function fetchParents() {
  try {
    const response = await fetch('/api/parents/listParents');
    const result = await response.json();
    
    if (result.statusCode === 200 && result.data) {
      parents.value = result.data;
    } else {
      console.error('Failed to fetch parents:', result.message);
    }
  } catch (error) {
    console.error('Error fetching parents:', error);
  }
}

function viewPatientProfile(patientId) {
  router.push({
    path: '/patientProfile',
    query: { patientId: patientId }
  });
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return 'N/A';
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age + ' years';
}

function getStatusColor(status) {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'inactive':
      return 'bg-red-100 text-red-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Patient Profile Selection</h1>
        <p class="text-gray-600 mt-1">Select a patient to view their comprehensive profile</p>
      </div>
      <rs-button variant="outline" @click="$router.go(-1)">
        <Icon name="material-symbols:arrow-back" class="mr-1" />
        Back
      </rs-button>
    </div>

    <!-- Search and Filter Section -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4">
      <div>
        <div class="relative">
          <Icon name="material-symbols:search" class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by name, nickname, or IC..."
            class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>
      </div>
      
      <div>
        <select
          v-model="selectedParent"
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="">All Parents</option>
          <option 
            v-for="parent in parents" 
            :key="parent.parentID" 
            :value="parent.parentID"
          >
            {{ parent.fullName }}
          </option>
        </select>
      </div>
      
      <!-- <div class="flex items-end bg-white border-gray-500 rounded-lg border-1">
        <rs-button 
          variant="outline" 
          @click="searchQuery = ''; selectedParent = ''"
          class="w-full"
        >
          <Icon name="material-symbols:refresh" class="mr-1 " />
          Clear Filters
        </rs-button>
      </div> -->
    </div>


    <!-- Loading State -->
    <div v-if="isLoading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      <span class="ml-3 text-gray-600">Loading patients...</span>
    </div>

    <!-- Patients List -->
    <div v-else>
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-semibold text-gray-900">
          Patients ({{ filteredPatients.length }})
        </h2>
        <div class="text-sm text-gray-500">
          Showing {{ filteredPatients.length }} of {{ patients.length }} patients
        </div>
      </div>

      <div v-if="filteredPatients.length === 0" class="text-center py-12">
        <Icon name="material-symbols:person-off" size="64" class="mx-auto mb-4 text-gray-300" />
        <h3 class="text-lg font-medium text-gray-600 mb-2">No patients found</h3>
        <p class="text-gray-500">
          {{ searchQuery || selectedParent ? 'Try adjusting your search criteria.' : 'No patients have been registered yet.' }}
        </p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div 
          v-for="patient in filteredPatients" 
          :key="patient.childID"
          class="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
          @click="viewPatientProfile(patient.childID)"
        >
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center space-x-3">
              <div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Icon name="material-symbols:person" size="24" class="text-primary" />
              </div>
              <div>
                <h3 class="font-semibold text-gray-900">{{ patient.fullname || 'Unknown' }}</h3>
                <p class="text-sm text-gray-500">{{ patient.nickname || 'No nickname' }}</p>
              </div>
            </div>
            <span 
              class="px-2 py-1 text-xs rounded-full"
              :class="getStatusColor(patient.status)"
            >
              {{ patient.status || 'Unknown' }}
            </span>
          </div>

          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-500">IC Number:</span>
              <span class="font-medium">{{ patient.icNumber || 'N/A' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Age:</span>
              <span class="font-medium">{{ calculateAge(patient.dateOfBirth) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Gender:</span>
              <span class="font-medium">{{ patient.gender || 'N/A' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Available Sessions:</span>
              <span class="font-medium text-primary">{{ patient.availableSession || 0 }}</span>
            </div>
          </div>

          <div class="mt-4 pt-4 border-t border-gray-100">
            <div class="flex justify-between items-center">
              <span class="text-xs text-gray-500">Parent: {{ patient.parentUsername || 'N/A' }}</span>
              <rs-button variant="primary" size="sm">
                <Icon name="material-symbols:visibility" class="mr-1" />
                View Profile
              </rs-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template> 