<script setup>
import { ref, onMounted } from 'vue';
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

const showConfirmToggleModal = ref(false);
const pendingToggleChild = ref(null);

const availableSessionOptions = ref([]);
const sessionMap = ref({});

const message = ref('');
const messageType = ref('success');

function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => (message.value = ''), 5000);
}

const form = ref({
  nickname: null,
  gender: '',
  icNumber: '',
  dateOfBirth: '',
  autismDiagnose: null,
  diagnosedDate: '',
  availableSession: '',
  status: '',
});

// Fetch children and session data
async function fetchChildren() {
  try {
    const [childRes, sessionRes] = await Promise.all([
      fetch(`/api/parents/manageChild/listChild?parentID=${parentID.value}`),
      fetch('/api/parents/lookupAvailSession')
    ]);

    const childData = await childRes.json();
    const sessionData = await sessionRes.json();

    sessionMap.value = Object.fromEntries(sessionData.map(s => [s.lookupID, s.title]));

    if (childData.statusCode === 200) {
      children.value = childData.data.map(c => ({
        ...c,
        dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth).toISOString().split('T')[0] : '',
        diagnosedDate: c.diagnosedDate ? new Date(c.diagnosedDate).toISOString().split('T')[0] : '',
        availableSessionName: sessionMap.value[c.availableSession] || 'Unknown'
      }));
    } else {
      showMessage(`Error loading children: ${childData.message}`, 'error');
    }

    availableSessionOptions.value = [
      { label: '-- Please select --', value: '' },
      ...sessionData.map(s => ({ label: s.title, value: s.lookupID }))
    ];
  } catch (err) {
    console.error('Failed to load children:', err);
    showMessage('Failed to load children.', 'error');
  }
}

onMounted(fetchChildren);

async function saveChild() {
  try {
    const response = await fetch('/api/parents/manageChild/insertChild', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form.value, parentID: parseInt(parentID.value), userID: parseInt(userID.value) })
    });

    const result = await response.json();
    if (result.statusCode === 200) {
      alert('Child added successfully', 'success');
      showAddForm.value = false;
      form.value = {
        nickname: null,
        gender: '',
        icNumber: '',
        dateOfBirth: '',
        autismDiagnose: null,
        diagnosedDate: '',
        availableSession: '',
        status: '',
      };
      await fetchChildren();
    } else {
      showMessage(`Error: ${result.message}`, 'error');
    }
  } catch (err) {
    console.error('Save child error:', err);
    showMessage('Failed to add child.', 'error');
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
  }
}

async function searchICNumber() {
  try {
    const res = await fetch(`/api/parents/manageChild/searchIc?icNumber=${searchIC.value}`);
    const data = await res.json();

    if (data.statusCode === 200) {
      searchResults.value = data.data.map(c => ({
        ...c,
        dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth).toISOString().split('T')[0] : '',
        diagnosedDate: c.diagnosedDate ? new Date(c.diagnosedDate).toISOString().split('T')[0] : '',
        availableSessionName: sessionMap.value[c.availableSession] || 'Unknown'
      }));
      selectedUser.value = null;
    } else {
      showMessage(`No result: ${data.message}`, 'error');
      searchResults.value = [];
    }
  } catch (err) {
    console.error('Search IC error:', err);
    showMessage('Error searching IC number.', 'error');
  }
}

function selectUser(user) {
  selectedUser.value = user;
}

async function addSelectedUserAsChild() {
  if (!selectedUser.value) return showMessage('No user selected', 'error');

  try {
    const response = await fetch('/api/parents/manageChild/insertChild', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: selectedUser.value.fullname,
        gender: selectedUser.value.gender || '',
        icNumber: selectedUser.value.icNumber,
        dateOfBirth: selectedUser.value.dateOfBirth || '',
        autismDiagnose: selectedUser.value.autismDiagnose || 'N/A',
        diagnosedDate: selectedUser.value.diagnosedDate || new Date().toISOString().split('T')[0],
        availableSession: selectedUser.value.availableSession || 'defaultSessionID',
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

      <table class="min-w-full border border-gray-300 text-sm">
        <thead class="bg-gray-100">
          <tr>
            <th class="px-3 py-2 border">Nickname</th>
            <th class="px-3 py-2 border">Gender</th>
            <th class="px-3 py-2 border">IC Number</th>
            <th class="px-3 py-2 border">Diagnosed Date</th>
            <th class="px-3 py-2 border">Autism Diagnose</th>
            <th class="px-3 py-2 border">Session</th>
            <th class="px-3 py-2 border">Status</th>
            <th class="px-3 py-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="child in children" :key="child.childID">
            <td class="px-3 py-2 border">{{ child.nickname }}</td>
            <td class="px-3 py-2 border">{{ child.gender }}</td>
            <td class="px-3 py-2 border">{{ child.icNumber }}</td>
            <td class="px-3 py-2 border">{{ child.diagnosedDate }}</td>
            <td class="px-3 py-2 border">{{ child.autismDiagnose }}</td>
            <td class="px-3 py-2 border">{{ child.availableSessionName }}</td>
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
        <FormKit type="text" v-model="form.nickname" label="Nickname" validation="required" validation-visibility="live"/>
        <FormKit type="select" v-model="form.gender" label="Gender" :options="['-- Please select --', 'Male', 'Female']" validation="required"  />
        <FormKit type="text" v-model="form.icNumber" label="IC Number" validation="required" />
        <FormKit type="date" v-model="form.dateOfBirth" label="Date of Birth" validation="required" />
        <FormKit type="text" v-model="form.autismDiagnose" label="Autism Diagnose" validation="required"/>
        <FormKit type="date" v-model="form.diagnosedDate" label="Diagnosed Date" validation="required"  />
        <FormKit type="select" v-model="form.availableSession" label="Available Session" :options="availableSessionOptions" validation="required" />
        <FormKit type="select" v-model="form.status" label="Status" :options="['-- Please select --', 'Active', 'Inactive']" validation="required" />

        <div class="flex gap-4 mt-4">
          <rs-button class="w-full" @click="saveChild">Save</rs-button>
          <rs-button variant="ghost" class="w-full bg-gray-200" @click="showAddForm = false">Cancel</rs-button>
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

      <FormKit type="text" v-model="searchIC" label="IC Number" placeholder="Example: 1234567890 ( Without '-' )"  />
      <div class="flex gap-4 mt-2">
        <rs-button class="w-full" @click="searchICNumber">Search</rs-button>
        <rs-button variant="ghost" class="w-full bg-gray-200" @click="closeSearchICForm">Cancel</rs-button>
      </div>

      <!-- Results -->
      <div v-if="searchResults.length" class="mt-4">
        <table class="min-w-full border border-gray-300 text-sm rounded-lg overflow-hidden shadow">
          <thead class="bg-gray-200 text-gray-700 uppercase tracking-wider">
            <tr>
              <th class="px-4 py-2 border">Nickname</th>
              <th class="px-4 py-2 border">Gender</th>
              <th class="px-4 py-2 border">IC Number</th>
              <th class="px-4 py-2 border">Diagnosed Date</th>
              <th class="px-4 py-2 border">Autism Diagnose</th>
              <th class="px-4 py-2 border">Session</th>
              <th class="px-4 py-2 border">Status</th>
              <th class="px-4 py-2 border text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in searchResults" :key="u.userID" class="hover:bg-gray-100">
              <td class="px-4 py-2 border text-center">{{ u.fullname }}</td>
              <td class="px-4 py-2 border text-center">{{ u.gender }}</td>
              <td class="px-4 py-2 border text-center">{{ u.icNumber }}</td>
              <td class="px-4 py-2 border text-center">{{ u.diagnosedDate }}</td>
              <td class="px-4 py-2 border text-center">{{ u.autismDiagnose }}</td>
              <td class="px-4 py-2 border text-center">{{ u.availableSessionName }}</td>
              <td class="px-4 py-2 border text-center">{{ u.status }}</td>
              <td class="px-4 py-2 border text-center">
                <rs-button @click="selectUser(u); addSelectedUserAsChild()">Add as Child</rs-button>
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
