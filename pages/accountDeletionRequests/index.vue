<script setup>
import { computed, onMounted, ref } from "vue";

const rawData = ref([]);
const isLoading = ref(false);
const error = ref(null);
const message = ref("");
const messageType = ref("success");
const statusFilter = ref("All");

const showUpdateModal = ref(false);
const selectedRequest = ref(null);
const updateStatus = ref("Pending");
const adminNotes = ref("");
const isSaving = ref(false);

const statusOptions = ["All", "Pending", "In Progress", "Completed", "Rejected"];
const editableStatuses = ["Pending", "In Progress", "Completed", "Rejected"];

const columns = [
  { name: "requestId", label: "ID" },
  { name: "fullName", label: "Full Name" },
  { name: "email", label: "Email" },
  { name: "accountType", label: "Account Type" },
  { name: "status", label: "Status" },
  { name: "createdAt", label: "Submitted" },
  { name: "action", label: "Actions" },
];

function showMessage(msg, type = "success") {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => (message.value = ""), 3000);
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

async function fetchRequests() {
  isLoading.value = true;
  error.value = null;
  try {
    const query =
      statusFilter.value && statusFilter.value !== "All"
        ? `?status=${encodeURIComponent(statusFilter.value)}`
        : "";
    const result = await $fetch(`/api/accountDeletionRequests/list${query}`);
    if (result.statusCode === 200) {
      rawData.value = result.data || [];
    } else {
      error.value = result.message || "Failed to load requests.";
    }
  } catch (err) {
    console.error(err);
    error.value = err?.data?.message || err.message || "Failed to load requests.";
  } finally {
    isLoading.value = false;
  }
}

onMounted(fetchRequests);

const tableData = computed(() =>
  rawData.value.map((item) => ({
    requestId: item.requestId,
    fullName: item.fullName,
    email: item.email,
    accountType: item.accountType,
    status: item.status,
    createdAt: formatDate(item.createdAt),
    action: "manage",
  }))
);

function getRequestById(requestId) {
  return rawData.value.find((item) => item.requestId === requestId);
}

function statusBadgeClass(status) {
  switch (status) {
    case "Completed":
      return "bg-green-100 text-green-800";
    case "Rejected":
      return "bg-red-100 text-red-800";
    case "In Progress":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-amber-100 text-amber-800";
  }
}

function openUpdateModal(row) {
  const request = getRequestById(row.requestId);
  if (!request) return;
  selectedRequest.value = request;
  updateStatus.value = request.status || "Pending";
  adminNotes.value = request.adminNotes || "";
  showUpdateModal.value = true;
}

async function saveStatus() {
  if (!selectedRequest.value) return;
  isSaving.value = true;
  try {
    const result = await $fetch("/api/accountDeletionRequests/updateStatus", {
      method: "PUT",
      body: {
        requestId: selectedRequest.value.requestId,
        status: updateStatus.value,
        adminNotes: adminNotes.value,
      },
    });

    if (result.statusCode === 200) {
      showMessage("Request updated successfully.");
      showUpdateModal.value = false;
      selectedRequest.value = null;
      await fetchRequests();
    } else {
      showMessage(result.message || "Failed to update request.", "error");
    }
  } catch (err) {
    console.error(err);
    showMessage(
      err?.data?.message || err.message || "Failed to update request.",
      "error"
    );
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Account Deletion Requests</h1>
    <p class="text-slate-500 mt-1">
      Review and process Autibile app account deletion requests. Verified deletions
      should be completed within 30 days.
    </p>

    <div class="card p-4 mt-4">
      <div
        v-if="message"
        class="mb-4 p-3 rounded text-white"
        :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'"
      >
        {{ message }}
      </div>

      <div class="flex flex-wrap items-end gap-3 mb-4">
        <div class="w-56">
          <FormKit
            type="select"
            label="Filter by status"
            v-model="statusFilter"
            :options="statusOptions"
            :classes="{ label: 'text-left' }"
          />
        </div>
        <rs-button @click="fetchRequests">Refresh</rs-button>
      </div>

      <p v-if="isLoading">Loading...</p>
      <p v-if="error" class="text-red-500">{{ error }}</p>

      <rs-table
        v-if="!isLoading && !error"
        :data="tableData"
        :columns="columns"
        :options="{ variant: 'default', striped: true, borderless: true }"
        :options-advanced="{ sortable: true, responsive: true, filterable: true }"
        advanced
      >
        <template v-slot:status="row">
          <span
            class="px-2 py-1 rounded text-xs font-semibold"
            :class="statusBadgeClass(row.value.status)"
          >
            {{ row.value.status }}
          </span>
        </template>
        <template v-slot:action="row">
          <div class="flex justify-center items-center">
            <rs-button size="sm" @click="openUpdateModal(row.value)">
              Manage
            </rs-button>
          </div>
        </template>
      </rs-table>
    </div>

    <rs-modal
      title="Manage Deletion Request"
      ok-title="Save"
      cancel-title="Cancel"
      :ok-callback="saveStatus"
      v-model="showUpdateModal"
      :overlay-close="false"
      :ok-disabled="isSaving"
    >
      <div v-if="selectedRequest" class="space-y-3 text-left">
        <p>
          <span class="font-semibold">Request ID:</span>
          {{ selectedRequest.requestId }}
        </p>
        <p>
          <span class="font-semibold">Name:</span>
          {{ selectedRequest.fullName }}
        </p>
        <p>
          <span class="font-semibold">Email:</span>
          <a
            :href="`mailto:${selectedRequest.email}`"
            class="text-primary underline"
          >
            {{ selectedRequest.email }}
          </a>
        </p>
        <p>
          <span class="font-semibold">Account type:</span>
          {{ selectedRequest.accountType }}
        </p>
        <p>
          <span class="font-semibold">Submitted:</span>
          {{ formatDate(selectedRequest.createdAt) }}
        </p>
        <p>
          <span class="font-semibold">Additional info:</span>
          {{ selectedRequest.additionalInfo || "—" }}
        </p>

        <FormKit
          type="select"
          label="Status"
          v-model="updateStatus"
          :options="editableStatuses"
          :classes="{ label: 'text-left' }"
        />
        <FormKit
          type="textarea"
          label="Admin notes"
          v-model="adminNotes"
          rows="3"
          :classes="{ label: 'text-left' }"
        />
      </div>
    </rs-modal>
  </div>
</template>
