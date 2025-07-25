<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();

const parentID = ref(route.query.parentID);
const userID = ref(route.query.userID);
const children = ref([]);
const showAddForm = ref(false);
const showSearchICForm = ref(false);
const searchIC = ref('');
const searchResults = ref([]);
const selectedUser = ref(null);
const isLoading = ref(false);
const isSubmitting = ref(false);
const isSearching = ref(false);
const isTogglingStatus = ref(false);

const showConfirmToggleModal = ref(false);
const pendingToggleChild = ref(null);

const message = ref('');
const messageType = ref('success');

// Custom validation for IC number
const icError = ref('');

function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => (message.value = ''), 5000);
}

const form = ref({
  fullname: '',
  nickname: null,
  gender: '',
  icNumber: '',
  dateOfBirth: '',
  autismDiagnose: null,
  diagnosedDate: '',
  availableSession: 0,
  status: '',
});

// IC validation
watch(() => form.value.icNumber, (newVal) => {
  icError.value = '';
  if (!newVal) return;
  
  if (newVal.toString().length !== 12) {
    icError.value = 'IC number must be exactly 12 digits';
  }
});

// Validate IC when searching
watch(() => searchIC.value, (newVal) => {
  if (newVal && newVal.length !== 12) {
    showMessage('IC number must be exactly 12 digits', 'error');
  }
});

// Fetch children data
async function fetchChildren() {
  isLoading.value = true;
  try {
    const childRes = await fetch(`/api/parents/manageChild/listChild?parentID=${parentID.value}`);
    const childData = await childRes.json();

    if (childData.statusCode === 200) {
      children.value = childData.data.map(c => ({
        ...c,
        dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth).toISOString().split('T')[0] : '',
        diagnosedDate: c.diagnosedDate ? new Date(c.diagnosedDate).toISOString().split('T')[0] : '',
        // Use the actual available session count directly
        availableSessionCount: c.availableSession || 0
      }));
    } else {
      showMessage(`Error loading children: ${childData.message}`, 'error');
    }

  } catch (err) {
    console.error('Failed to load children:', err);
    showMessage('Failed to load children.', 'error');
  } finally {
    isLoading.value = false;
  }
}

onMounted(fetchChildren);

async function saveChild() {
  // Validate IC number
  if (form.value.icNumber.toString().length !== 12) {
    icError.value = 'IC number must be exactly 12 digits';
    showMessage('IC number must be exactly 12 digits.', 'error');
    return;
  }

  // Debug: Log form values
  console.log('Form values:', form.value);
  
  // Additional validation
  if (!form.value.fullname || !form.value.nickname || !form.value.gender || 
      !form.value.dateOfBirth || !form.value.autismDiagnose || !form.value.diagnosedDate || 
      !form.value.status || form.value.status === '-- Please select --' ||
      form.value.availableSession === null || form.value.availableSession === undefined) {
    
    // Debug: Log which fields are missing
    console.log('Missing fields check:');
    console.log('fullname:', !!form.value.fullname);
    console.log('nickname:', !!form.value.nickname);
    console.log('gender:', !!form.value.gender);
    console.log('dateOfBirth:', !!form.value.dateOfBirth);
    console.log('autismDiagnose:', !!form.value.autismDiagnose);
    console.log('diagnosedDate:', !!form.value.diagnosedDate);
    console.log('status:', !!form.value.status);
    console.log('status value:', form.value.status);
    console.log('availableSession:', form.value.availableSession);
    
    showMessage('Please fill in all required fields.', 'error');
    return;
  }

  isSubmitting.value = true;
  try {
    const requestBody = { 
      ...form.value, 
      parentID: parseInt(parentID.value), 
      userID: parseInt(userID.value),
      availableSession: parseInt(form.value.availableSession) || 0
    };
    
    console.log('Sending request:', requestBody); // Debug log
    
    const response = await fetch('/api/parents/manageChild/insertChild', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    console.log('Response status:', response.status); // Debug log
    const result = await response.json();
    console.log('Response result:', result); // Debug log
    if (result.statusCode === 200) {
      showMessage('Child added successfully', 'success');
      showAddForm.value = false;
      form.value = {
        fullname: '',
        nickname: null,
        gender: '',
        icNumber: '',
        dateOfBirth: '',
        autismDiagnose: null,
        diagnosedDate: '',
        availableSession: 0,
        status: '',
      };
      await fetchChildren();
    } else {
      showMessage(`Error: ${result.message}`, 'error');
    }
  } catch (err) {
    console.error('Save child error:', err);
    showMessage('Failed to add child.', 'error');
  } finally {
    isSubmitting.value = false;
  }
}

function confirmToggleStatus(child) {
  pendingToggleChild.value = child;
  showConfirmToggleModal.value = true;
}

function cancelToggleStatus() {
  pendingToggleChild.value = null;
  showConfirmToggleModal.value = false;
}

async function performToggleStatus() {
  const child = pendingToggleChild.value;
  const newStatus = child.status === 'Active' ? 'Inactive' : 'Active';
  isTogglingStatus.value = true;

  try {
    const res = await fetch('/api/parents/manageChild/updateStatusChild', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childID: child.childID, status: newStatus }),
    });

    const result = await res.json();
    if (result.statusCode === 200) {
      child.status = newStatus;
      showMessage(`Child status updated to ${newStatus}`, 'success');
    } else {
      showMessage(`Error updating status: ${result.message}`, 'error');
    }
  } catch (err) {
    console.error('Status update error:', err);
    showMessage('An error occurred while updating status.', 'error');
  } finally {
    showConfirmToggleModal.value = false;
    pendingToggleChild.value = null;
    isTogglingStatus.value = false;
  }
}

async function searchICNumber() {
  // Validate search IC
  if (searchIC.value.length !== 12) {
    showMessage('IC number must be exactly 12 digits', 'error');
    return;
  }

  isSearching.value = true;
  try {
    const res = await fetch(`/api/parents/manageChild/searchIc?icNumber=${searchIC.value}`);
    const data = await res.json();

    if (data.statusCode === 200) {
      searchResults.value = data.data.map(c => ({
        ...c,
        dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth).toISOString().split('T')[0] : '',
        diagnosedDate: c.diagnosedDate ? new Date(c.diagnosedDate).toISOString().split('T')[0] : '',
        // Use the actual available session count directly
        availableSessionCount: c.availableSession || 0
      }));
      selectedUser.value = null;
    } else {
      showMessage(`No result: ${data.message}`, 'error');
      searchResults.value = [];
    }
  } catch (err) {
    console.error('Search IC error:', err);
    showMessage('Error searching IC number.', 'error');
  } finally {
    isSearching.value = false;
  }
}

function selectUser(user) {
  selectedUser.value = user;
}

async function addSelectedUserAsChild() {
  if (!selectedUser.value) return showMessage('No user selected', 'error');
  isSubmitting.value = true;

  try {
    const response = await fetch('/api/parents/manageChild/insertChild', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullname: selectedUser.value.fullname || selectedUser.value.nickname,
        nickname: selectedUser.value.nickname,
        gender: selectedUser.value.gender || '',
        icNumber: selectedUser.value.icNumber,
        dateOfBirth: selectedUser.value.dateOfBirth || '',
        autismDiagnose: selectedUser.value.autismDiagnose || 'N/A',
        diagnosedDate: selectedUser.value.diagnosedDate || new Date().toISOString().split('T')[0],
        availableSession: 0, // Set to 0 when adding as child
        status: 'Active',
        parentID: parseInt(parentID.value),
        userID: parseInt(userID.value),
      }),
    });

    const result = await response.json();
    if (result.statusCode === 200) {
      showMessage(result.message, 'success');
      await fetchChildren();
      //showSearchICForm.value = false;
      //searchIC.value = '';
      //searchResults.value = [];
      //selectedUser.value = null;
    } else if (result.statusCode === 409) {
      showMessage('This child is already linked to this parent', 'error');
    } else {
      showMessage(`Error: ${result.message}`, 'error');
    }
  } catch (err) {
    console.error('Add child error:', err);
    showMessage('Failed to add child.', 'error');
  } finally {
    isSubmitting.value = false;
  }
}

function closeSearchICForm() {
  showSearchICForm.value = false;
  searchIC.value = '';
  searchResults.value = [];
  selectedUser.value = null;
}
</script>


<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Manage Children</h1>

    <!-- Child List -->
    <div class="card p-4 mb-4">
      <div class="flex justify-between items-center mb-3">
        <h2 class="text-lg font-semibold">Existing Children</h2>

        <div class="flex gap-2">
          <rs-button @click="showSearchICForm = true">
            <Icon name="material-symbols:search" class="mr-1" /> Existing Child
          </rs-button>

          <rs-button @click="showAddForm = true">
            <Icon name="material-symbols:add" class="mr-1" /> New Child
          </rs-button>
        </div>
      </div>

      <div v-if="isLoading" class="flex justify-center my-8">
        <div class="flex flex-col items-center">
          <Icon name="line-md:loading-twotone-loop" size="48" class="text-primary mb-2" />
          <span>Loading children data...</span>
        </div>
      </div>

      <table v-else class="min-w-full border border-gray-300 text-sm">
        <thead class="bg-gray-100">
          <tr>
            <th class="px-3 py-2 border">Full Name</th>
            <th class="px-3 py-2 border">Nickname</th>
            <th class="px-3 py-2 border">Gender</th>
            <th class="px-3 py-2 border">IC Number</th>
            <th class="px-3 py-2 border">Diagnosed Date</th>
            <th class="px-3 py-2 border">Autism Diagnose</th>
            <th class="px-3 py-2 border">Available Sessions</th>
            <th class="px-3 py-2 border">Status</th>
            <th class="px-3 py-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="child in children" :key="child.childID">
            <td class="px-3 py-2 border">{{ child.fullname || '-' }}</td>
            <td class="px-3 py-2 border">{{ child.nickname }}</td>
            <td class="px-3 py-2 border">{{ child.gender }}</td>
            <td class="px-3 py-2 border">{{ child.icNumber }}</td>
            <td class="px-3 py-2 border">{{ child.diagnosedDate }}</td>
            <td class="px-3 py-2 border">{{ child.autismDiagnose }}</td>
            <td class="px-3 py-2 border text-center">{{ child.availableSessionCount }}</td>
            <td class="px-3 py-2 border text-center">
              <input
                type="checkbox"
                class="toggle-checkbox"
                :checked="child.status === 'Active'"
                @click.prevent="confirmToggleStatus(child)"
              />
            </td>
            <td class="px-3 py-2 border text-center">
              <span
                class="cursor-pointer text-gray-600 hover:text-blue-600"
                @click="router.push({ path: '/userManagement/parent/editChild', query: { childID: child.childID, parentID: parentID, userID: userID } })"
              >
                <Icon name="material-symbols:edit" size="20" />
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add Child Form -->
    <div v-if="showAddForm" class="card p-4 border border-gray-200">
      <h2 class="text-lg font-semibold mb-2">Add New Child</h2>
      <FormKit type="form" :actions="false">
        <FormKit type="text" v-model="form.fullname" label="Full Name" validation="required" validation-visibility="live"/>
        <FormKit type="text" v-model="form.nickname" label="Nickname" validation="required" validation-visibility="live"/>
        <FormKit type="select" v-model="form.gender" label="Gender" :options="['-- Please select --', 'Male', 'Female']" validation="required"  />
        <FormKit type="text" v-model="form.icNumber" label="IC Number" validation="required" placeholder="Enter 12 digit IC number" />
        <p v-if="icError" class="text-red-500 text-sm mt-1 mb-2">{{ icError }}</p>
        <FormKit type="date" v-model="form.dateOfBirth" label="Date of Birth" validation="required" />
        <FormKit type="text" v-model="form.autismDiagnose" label="Autism Diagnose" validation="required"/>
        <FormKit type="date" v-model="form.diagnosedDate" label="Diagnosed Date" validation="required"  />
        <FormKit type="number" v-model="form.availableSession" label="Available Sessions" validation="required|number|min:0" placeholder="0" disabled/>
        <p class="text-sm text-gray-600 mt-1">Available sessions start at 0 for new children. Sessions can be added later through package purchases.</p>
        <FormKit type="select" v-model="form.status" label="Status" :options="['-- Please select --', 'Active', 'Inactive']" validation="required" />

        <div class="flex gap-4 mt-4">
          <rs-button class="w-full" @click="saveChild" :disabled="isSubmitting">
            <div class="flex items-center justify-center">
              <Icon v-if="isSubmitting" name="line-md:loading-twotone-loop" class="mr-2" />
              <span>{{ isSubmitting ? 'Saving...' : 'Save' }}</span>
            </div>
          </rs-button>
          <rs-button variant="ghost" class="w-full bg-gray-200" @click="showAddForm = false" :disabled="isSubmitting">Cancel</rs-button>
        </div>

        <!-- Message display -->
        <div v-if="message" class="mt-4 p-3 rounded text-white"
             :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
          {{ message }}
        </div>
      </FormKit>
    </div>

    <!-- Search IC Form -->
    <div v-if="showSearchICForm" class="card p-4 border border-gray-200 mb-4 relative">
      <!-- X Close Button -->
      <button
        @click="closeSearchICForm"
        class="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl font-bold"
        aria-label="Close"
      >
        &times;
      </button>

      <h2 class="text-lg font-semibold mb-2">Search User Patient by IC Number</h2>

      <FormKit type="text" v-model="searchIC" label="IC Number" placeholder="Enter exactly 12 digits"  />
      <div class="flex gap-4 mt-2">
        <rs-button class="w-full" @click="searchICNumber" :disabled="isSearching">
          <div class="flex items-center justify-center">
            <Icon v-if="isSearching" name="line-md:loading-twotone-loop" class="mr-2" />
            <span>{{ isSearching ? 'Searching...' : 'Search' }}</span>
          </div>
        </rs-button>
        <rs-button variant="ghost" class="w-full bg-gray-200" @click="closeSearchICForm" :disabled="isSearching">Cancel</rs-button>
      </div>

      <!-- Results -->
      <div v-if="searchResults.length" class="mt-4">
        <table class="min-w-full border border-gray-300 text-sm rounded-lg overflow-hidden shadow">
          <thead class="bg-gray-200 text-gray-700 uppercase tracking-wider">
            <tr>
              <th class="px-4 py-2 border">Full Name</th>
              <th class="px-4 py-2 border">Nickname</th>
              <th class="px-4 py-2 border">Gender</th>
              <th class="px-4 py-2 border">IC Number</th>
              <th class="px-4 py-2 border">Diagnosed Date</th>
              <th class="px-4 py-2 border">Autism Diagnose</th>
              <th class="px-4 py-2 border">Available Sessions</th>
              <th class="px-4 py-2 border">Status</th>
              <th class="px-4 py-2 border text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in searchResults" :key="u.userID" class="hover:bg-gray-100">
              <td class="px-4 py-2 border text-center">{{ u.fullname || '-' }}</td>
              <td class="px-4 py-2 border text-center">{{ u.nickname }}</td>
              <td class="px-4 py-2 border text-center">{{ u.gender }}</td>
              <td class="px-4 py-2 border text-center">{{ u.icNumber }}</td>
              <td class="px-4 py-2 border text-center">{{ u.diagnosedDate }}</td>
              <td class="px-4 py-2 border text-center">{{ u.autismDiagnose }}</td>
              <td class="px-4 py-2 border text-center">{{ u.availableSessionCount }}</td>
              <td class="px-4 py-2 border text-center">{{ u.status }}</td>
              <td class="px-4 py-2 border text-center">
                <rs-button @click="selectUser(u); addSelectedUserAsChild()" :disabled="isSubmitting">
                  <div class="flex items-center justify-center">
                    <Icon v-if="isSubmitting" name="line-md:loading-twotone-loop" class="mr-2" />
                    <span>{{ isSubmitting ? 'Adding...' : 'Add as Child' }}</span>
                  </div>
                </rs-button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="message" class="mb-4 p-3 rounded text-white"
            :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
          {{ message }}
        </div>
      </div>
    </div>


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
        <span v-if="pendingToggleChild?.status === 'Active'">deactivate</span>
        <span v-else>activate</span>
        this child (Nickname: {{ pendingToggleChild?.nickname }})?
      </p>

      <div v-if="isTogglingStatus" class="flex justify-center items-center mt-4 p-2 bg-blue-50 rounded-md">
        <Icon name="line-md:loading-twotone-loop" class="text-primary mr-2" />
        <span>Updating status...</span>
      </div>
    </rs-modal>
  </div>
</template>

<style scoped>
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
