<script setup>
import { ref } from 'vue';

const reports = ref([
  {
    id: 1,
    reportedBy: "Alice Admin",
    reason: "Spam",
    content: "Visit spamwebsite.com for cheap deals.",
    flagged: true,
    reportedUser: "Spam User",
    date: "2024-06-03",
    action: "review",
  },
  {
    id: 2,
    reportedBy: "Bob Moderator",
    reason: "Inappropriate Language",
    content: "Some inappropriate comment here.",
    flagged: true,
    reportedUser: "Troll123",
    date: "2024-06-04",
    action: "edit",
  },
  {
    id: 3,
    reportedBy: "Jane Smith",
    reason: "Off-topic",
    content: "Looking for recommendations for speech therapy in KL.",
    flagged: false,
    reportedUser: "Jane Smith",
    date: "2024-06-02",
    action: "edit",
  }
]);

const showModal = ref(false);
const modalAction = ref('');
const selectedReport = ref({});

function openModal(report, action) {
  selectedReport.value = { ...report };
  modalAction.value = action;
  showModal.value = true;
}

function reviewReport() {
  // Implement review logic here
  showModal.value = false;
}

function dismissReport() {
  // Remove the report from the list
  reports.value = reports.value.filter(r => r.id !== selectedReport.value.id);
  showModal.value = false;
}

function warnUser() {
  // Implement warn user logic here
  showModal.value = false;
}

function deleteContent() {
  // Implement delete content logic here
  showModal.value = false;
}
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Reported Content</h1>
    <div class="card p-4 mt-4">
      <rs-table
        :data="reports"
        :columns="[
          { name: 'reportedBy', label: 'Reported By' },
          { name: 'reason', label: 'Report Reason' },
          { name: 'content', label: 'Content Flagged' },
          { name: 'reportedUser', label: 'User Reported' },
          { name: 'date', label: 'Date' },
          { name: 'action', label: 'Moderation', slot: true }
        ]"
        :options="{ borderless: true }"
        advanced
      >
        <!-- Moderation tools: Review, Warn, Delete, Dismiss -->
        <template #action="slotProps">
          <div class="flex gap-2">
            <rs-button size="sm" @click="openModal(slotProps.row, 'review')">
              <Icon name="material-symbols:visibility" /> Review
            </rs-button>
            <rs-button size="sm" variant="success" @click="openModal(slotProps.row, 'warn')">
              <Icon name="material-symbols:warning" /> Warn User
            </rs-button>
            <rs-button size="sm" variant="danger" @click="openModal(slotProps.row, 'delete')">
              <Icon name="material-symbols:delete-outline" /> Delete Content
            </rs-button>
            <rs-button size="sm" variant="secondary" @click="openModal(slotProps.row, 'dismiss')">
              <Icon name="material-symbols:cancel" /> Dismiss
            </rs-button>
          </div>
        </template>
      </rs-table>
    </div>
    <rs-modal
      :title="{
        review: 'Review Report',
        warn: 'Warn User',
        delete: 'Delete Content',
        dismiss: 'Dismiss Report'
      }[modalAction]"
      ok-title="Confirm"
      cancel-title="Cancel"
      :ok-callback="() => {
        if (modalAction === 'review') reviewReport();
        else if (modalAction === 'warn') warnUser();
        else if (modalAction === 'delete') deleteContent();
        else if (modalAction === 'dismiss') dismissReport();
      }"
      v-model="showModal"
      :overlay-close="false"
    >
      <div v-if="modalAction === 'review'">
        <p><strong>Reported By:</strong> {{ selectedReport.reportedBy }}</p>
        <p><strong>Reason:</strong> {{ selectedReport.reason }}</p>
        <p><strong>User Reported:</strong> {{ selectedReport.reportedUser }}</p>
        <p><strong>Content:</strong> {{ selectedReport.content }}</p>
        <p><strong>Date:</strong> {{ selectedReport.date }}</p>
      </div>
      <div v-else-if="modalAction === 'warn'">
        <p>Are you sure you want to warn user <strong>{{ selectedReport.reportedUser }}</strong>?</p>
      </div>
      <div v-else-if="modalAction === 'delete'">
        <p>Are you sure you want to delete this content?</p>
        <p class="italic text-gray-600 mt-2">{{ selectedReport.content }}</p>
      </div>
      <div v-else-if="modalAction === 'dismiss'">
        <p>Are you sure you want to dismiss this report?</p>
      </div>
    </rs-modal>
  </div>
</template>