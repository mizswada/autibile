<script setup>
import { ref, onMounted, computed } from 'vue';

const rawData = ref([]);
const isLoading = ref(false);
const error = ref(null);
const message = ref('');
const messageType = ref('success');

const showModal = ref(false);
const showApproveConfirm = ref(false);
const showModalDelete = ref(false);

const pendingApprovePractitioner = ref(null);
const pendingRejectPractitioner = ref(null);

const columns = [
  { name: 'fullName', label: 'Full Name' },
  { name: 'email', label: 'Email' },
  { name: 'phoneNumber', label: 'Phone Number' },
  { name: 'role', label: 'Role' },
  { name: 'department', label: 'Department' },
  { name: 'workplace', label: 'Workplace' },
  { name: 'action', label: 'Actions' },
];

function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => (message.value = ''), 3000);
}

async function fetchPractitioners() {
  isLoading.value = true;
  error.value = null;
  try {
    const res = await fetch('/api/userApproval/list');
    const result = await res.json();
    if (result.statusCode === 200) {
      rawData.value = result.data.map(p => ({
        practitionerID: p.practitionerID, // keep only in raw data
        fullName: p.fullName,
        email: p.email,
        phoneNumber: p.phone,
        role: p.type,
        department: p.department,
        workplace: p.workplace,
      }));
    } else {
      error.value = result.message;
    }
  } catch (err) {
    console.error(err);
    error.value = err.message;
  } finally {
    isLoading.value = false;
  }
}

onMounted(fetchPractitioners);

const tableData = computed(() =>
  rawData.value.map(p => ({
    fullName: p.fullName,
    email: p.email,
    phoneNumber: p.phoneNumber,
    role: p.role,
    department: p.department,
    workplace: p.workplace,
    action: 'edit',
  }))
);

function getPractitionerByEmail(email) {
  return rawData.value.find(p => p.email === email);
}

// Approve flow
function openApproveModal(row) {
  pendingApprovePractitioner.value = getPractitionerByEmail(row.email);
  showApproveConfirm.value = true;
}

async function approvePractitioner() {
  const practitioner = pendingApprovePractitioner.value;
  if (!practitioner) return;

  try {
    const res = await fetch('/api/userApproval/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ practitionerID: practitioner.practitionerID }),
    });
    const result = await res.json();
    if (result.statusCode === 200) {
      showMessage('This practitioner has been approved!');
      await fetchPractitioners();
    } else {
      showMessage(`Approval failed: ${result.message}`, 'error');
    }
  } catch (err) {
    console.error(err);
    showMessage('An error occurred while approving.', 'error');
  } finally {
    showApproveConfirm.value = false;
    pendingApprovePractitioner.value = null;
  }
}

// Reject flow
function openRejectModal(row) {
  pendingRejectPractitioner.value = getPractitionerByEmail(row.email);
  showModalDelete.value = true;
}

async function rejectPractitioner() {
  const practitioner = pendingRejectPractitioner.value;
  if (!practitioner) return;

  try {
    const res = await fetch('/api/userApproval/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ practitionerID: practitioner.practitionerID }),
    });
    const result = await res.json();
    if (result.statusCode === 200) {
      showMessage('This practitioner has been rejected!');
      await fetchPractitioners();
    } else {
      showMessage(`Rejection failed: ${result.message}`, 'error');
    }
  } catch (err) {
    console.error(err);
    showMessage('An error occurred while rejecting.', 'error');
  } finally {
    showModalDelete.value = false;
    pendingRejectPractitioner.value = null;
  }
}
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">User Approval (Doctor & Therapist)</h1>

    <div class="card p-4 mt-4">
      <div v-if="message" class="mb-4 p-3 rounded text-white"
           :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
        {{ message }}
      </div>

      <p v-if="isLoading">Loading...</p>
      <p v-if="error" class="text-red-500">{{ error }}</p>

      <rs-table
        v-if="!isLoading && !error"
        :data="tableData"
        :columns="columns"
        :options="{ variant: 'default', striped: true, borderless: true }"
        :options-advanced="{ sortable: true, responsive: true, filterable: false }"
        advanced
      >
        <template v-slot:action="row">
          <div class="flex justify-center items-center">
            <rs-button size="sm" class="mr-2" @click="openApproveModal(row.value)">
              Approve
            </rs-button>
            <rs-button size="sm" variant="danger" @click="openRejectModal(row.value)">
              Reject
            </rs-button>
          </div>
        </template>
      </rs-table>
    </div>

    <!-- Approve Confirmation Modal -->
    <rs-modal
      title="Approve Practitioner"
      ok-title="Approve"
      cancel-title="Cancel"
      :ok-callback="approvePractitioner"
      v-model="showApproveConfirm"
      :overlay-close="false"
    >
      <p>
        Are you sure you want to approve
        <span class="font-semibold">{{ pendingApprovePractitioner?.fullName }}</span>?
      </p>
    </rs-modal>

    <!-- Reject Confirmation Modal -->
    <rs-modal
      title="Reject Practitioner"
      ok-title="Reject"
      cancel-title="Cancel"
      :ok-callback="rejectPractitioner"
      v-model="showModalDelete"
      :overlay-close="false"
    >
      <p>
        Are you sure you want to reject
        <span class="font-semibold">{{ pendingRejectPractitioner?.fullName }}</span>?
      </p>
    </rs-modal>
  </div>
</template>
