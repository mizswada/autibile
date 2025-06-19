<script setup>
import { ref } from 'vue';

// Activity Plans
const activityPlans = ref([
  { id: 1, patientName: "Alice", name: "Speech Therapy Plan", description: "Weekly speech therapy activities", progress: "In Progress", action: "edit" },
  { id: 2, patientName: "Bob", name: "Social Skills Plan", description: "Group activities for social skills", progress: "Completed", action: "edit" },
]);

// Scheduled Sessions
const sessions = ref([
  { id: 1, patientName: "Alice", date: "2024-06-20", time: "10:00", therapist: "Jane Doe", status: "Scheduled", action: "edit" },
  { id: 2, patientName: "Bob", date: "2024-06-22", time: "14:00", therapist: "John Smith", status: "Completed", action: "edit" },
]);

// Assignments
const assignments = ref([
  { id: 1, patientName: "Alice", assignee: "Alice", assignedBy: "Admin", date: "2024-06-10", action: "edit" },
  { id: 2, patientName: "Bob", assignee: "Bob", assignedBy: "Admin", date: "2024-06-12", action: "edit" },
]);

// Feedback/Progress
const feedbacks = ref([
  { id: 1, patientName: "Alice", feedback: "Good progress in speech clarity.", date: "2024-06-15", action: "edit" },
  { id: 2, patientName: "Bob", feedback: "Excellent participation in group.", date: "2024-06-18", action: "edit" },
]);

// Modals and forms
const showPlanModal = ref(false);
const isEditPlan = ref(false);
const planForm = ref({ id: null, patientName: '', name: '', description: '', progress: '' });

const showSessionModal = ref(false);
const isEditSession = ref(false);
const sessionForm = ref({ id: null, patientName: '', date: '', time: '', therapist: '', status: '' });

const showAssignmentModal = ref(false);
const isEditAssignment = ref(false);
const assignmentForm = ref({ id: null, patientName: '', assignee: '', assignedBy: '', date: '' });

const showFeedbackModal = ref(false);
const isEditFeedback = ref(false);
const feedbackForm = ref({ id: null, patientName: '', feedback: '', date: '' });

// Activity Plan CRUD
function openPlanModal(plan = null) {
  if (plan) {
    planForm.value = { ...plan };
    isEditPlan.value = true;
  } else {
    planForm.value = { id: null, patientName: '', name: '', description: '', progress: '' };
    isEditPlan.value = false;
  }
  showPlanModal.value = true;
}
function savePlan() {
  if (isEditPlan.value) {
    const idx = activityPlans.value.findIndex(p => p.id === planForm.value.id);
    if (idx !== -1) activityPlans.value[idx] = { ...planForm.value };
  } else {
    activityPlans.value.push({ ...planForm.value, id: Date.now(), action: "edit" });
  }
  showPlanModal.value = false;
}
function deletePlan(id) {
  activityPlans.value = activityPlans.value.filter(p => p.id !== id);
}

// Session CRUD
function openSessionModal(session = null) {
  if (session) {
    sessionForm.value = { ...session };
    isEditSession.value = true;
  } else {
    sessionForm.value = { id: null, patientName: '', date: '', time: '', therapist: '', status: '' };
    isEditSession.value = false;
  }
  showSessionModal.value = true;
}
function saveSession() {
  if (isEditSession.value) {
    const idx = sessions.value.findIndex(s => s.id === sessionForm.value.id);
    if (idx !== -1) sessions.value[idx] = { ...sessionForm.value };
  } else {
    sessions.value.push({ ...sessionForm.value, id: Date.now(), action: "edit" });
  }
  showSessionModal.value = false;
}
function deleteSession(id) {
  sessions.value = sessions.value.filter(s => s.id !== id);
}

// Assignment CRUD
function openAssignmentModal(assignment = null) {
  if (assignment) {
    assignmentForm.value = { ...assignment };
    isEditAssignment.value = true;
  } else {
    assignmentForm.value = { id: null, patientName: '', assignee: '', assignedBy: '', date: '' };
    isEditAssignment.value = false;
  }
  showAssignmentModal.value = true;
}
function saveAssignment() {
  if (isEditAssignment.value) {
    const idx = assignments.value.findIndex(a => a.id === assignmentForm.value.id);
    if (idx !== -1) assignments.value[idx] = { ...assignmentForm.value };
  } else {
    assignments.value.push({ ...assignmentForm.value, id: Date.now(), action: "edit" });
  }
  showAssignmentModal.value = false;
}
function deleteAssignment(id) {
  assignments.value = assignments.value.filter(a => a.id !== id);
}

// Feedback CRUD
function openFeedbackModal(feedback = null) {
  if (feedback) {
    feedbackForm.value = { ...feedback };
    isEditFeedback.value = true;
  } else {
    feedbackForm.value = { id: null, patientName: '', feedback: '', date: '' };
    isEditFeedback.value = false;
  }
  showFeedbackModal.value = true;
}
function saveFeedback() {
  if (isEditFeedback.value) {
    const idx = feedbacks.value.findIndex(f => f.id === feedbackForm.value.id);
    if (idx !== -1) feedbacks.value[idx] = { ...feedbackForm.value };
  } else {
    feedbacks.value.push({ ...feedbackForm.value, id: Date.now(), action: "edit" });
  }
  showFeedbackModal.value = false;
}
function deleteFeedback(id) {
  feedbacks.value = feedbacks.value.filter(f => f.id !== id);
}
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Therapy & Activity Plan Management</h1>

    <!-- Activity Plans -->
    <div class="card p-4 mt-4">
      <div class="flex justify-between items-center mb-2">
        <h2 class="text-xl font-semibold">Activity Plans</h2>
        <rs-button @click="openPlanModal()">Add Plan</rs-button>
      </div>
      <rs-table
        :data="activityPlans"
        :columns="[
          { name: 'patientName', label: 'Patient Name' },
          { name: 'name', label: 'Plan Name' },
          { name: 'description', label: 'Description' },
          { name: 'progress', label: 'Progress' },
          { name: 'action', label: 'Actions', slot: true }
        ]"
        :options="{ borderless: true }"
        advanced
      >
        <template #action="slotProps">
          <div class="flex gap-2">
            <rs-button size="sm" @click="openPlanModal(slotProps.row)">
              <Icon name="material-symbols:edit-outline-rounded" />
            </rs-button>
            <rs-button size="sm" variant="danger" @click="deletePlan(slotProps.row.id)">
              <Icon name="material-symbols:delete-outline" />
            </rs-button>
          </div>
        </template>
      </rs-table>
    </div>

    <!-- Scheduled Sessions -->
    <div class="card p-4 mt-4">
      <div class="flex justify-between items-center mb-2">
        <h2 class="text-xl font-semibold">Scheduled Sessions</h2>
        <rs-button @click="openSessionModal()">Add Session</rs-button>
      </div>
      <rs-table
        :data="sessions"
        :columns="[
          { name: 'patientName', label: 'Patient Name' },
          { name: 'date', label: 'Date' },
          { name: 'time', label: 'Time' },
          { name: 'therapist', label: 'Therapist' },
          { name: 'status', label: 'Status' },
          { name: 'action', label: 'Actions', slot: true }
        ]"
        :options="{ borderless: true }"
        advanced
      >
        <template #action="slotProps">
          <div class="flex gap-2">
            <rs-button size="sm" @click="openSessionModal(slotProps.row)">
              <Icon name="material-symbols:edit-outline-rounded" />
            </rs-button>
            <rs-button size="sm" variant="danger" @click="deleteSession(slotProps.row.id)">
              <Icon name="material-symbols:delete-outline" />
            </rs-button>
          </div>
        </template>
      </rs-table>
    </div>

    <!-- Assignments -->
    <div class="card p-4 mt-4">
      <div class="flex justify-between items-center mb-2">
        <h2 class="text-xl font-semibold">Assignments</h2>
        <rs-button @click="openAssignmentModal()">Assign Plan</rs-button>
      </div>
      <rs-table
        :data="assignments"
        :columns="[
          { name: 'patientName', label: 'Patient Name' },
          { name: 'assignee', label: 'Assignee' },
          { name: 'assignedBy', label: 'Assigned By' },
          { name: 'date', label: 'Date' },
          { name: 'action', label: 'Actions', slot: true }
        ]"
        :options="{ borderless: true }"
        advanced
      >
        <template #action="slotProps">
          <div class="flex gap-2">
            <rs-button size="sm" @click="openAssignmentModal(slotProps.row)">
              <Icon name="material-symbols:edit-outline-rounded" />
            </rs-button>
            <rs-button size="sm" variant="danger" @click="deleteAssignment(slotProps.row.id)">
              <Icon name="material-symbols:delete-outline" />
            </rs-button>
          </div>
        </template>
      </rs-table>
    </div>

    <!-- Feedback/Progress -->
    <div class="card p-4 mt-4">
      <div class="flex justify-between items-center mb-2">
        <h2 class="text-xl font-semibold">Progress & Feedback</h2>
        <rs-button @click="openFeedbackModal()">Add Feedback</rs-button>
      </div>
      <rs-table
        :data="feedbacks"
        :columns="[
          { name: 'patientName', label: 'Patient Name' },
          { name: 'feedback', label: 'Feedback' },
          { name: 'date', label: 'Date' },
          { name: 'action', label: 'Actions', slot: true }
        ]"
        :options="{ borderless: true }"
        advanced
      >
        <template #action="slotProps">
          <div class="flex gap-2">
            <rs-button size="sm" @click="openFeedbackModal(slotProps.row)">
              <Icon name="material-symbols:edit-outline-rounded" />
            </rs-button>
            <rs-button size="sm" variant="danger" @click="deleteFeedback(slotProps.row.id)">
              <Icon name="material-symbols:delete-outline" />
            </rs-button>
          </div>
        </template>
      </rs-table>
    </div>

    <!-- Modals -->
    <rs-modal
      :title="isEditPlan ? 'Edit Activity Plan' : 'Add Activity Plan'"
      ok-title="Save"
      cancel-title="Cancel"
      :ok-callback="savePlan"
      v-model="showPlanModal"
      :overlay-close="false"
    >
      <FormKit type="text" v-model="planForm.patientName" name="patientName" label="Patient Name" />
      <FormKit type="text" v-model="planForm.name" name="planName" label="Plan Name" />
      <FormKit type="text" v-model="planForm.description" name="description" label="Description" />
      <FormKit type="text" v-model="planForm.progress" name="progress" label="Progress" />
    </rs-modal>

    <rs-modal
      :title="isEditSession ? 'Edit Session' : 'Add Session'"
      ok-title="Save"
      cancel-title="Cancel"
      :ok-callback="saveSession"
      v-model="showSessionModal"
      :overlay-close="false"
    >
      <FormKit type="text" v-model="sessionForm.patientName" name="patientName" label="Patient Name" />
      <FormKit type="date" v-model="sessionForm.date" name="date" label="Date" />
      <FormKit type="time" v-model="sessionForm.time" name="time" label="Time" />
      <FormKit type="text" v-model="sessionForm.therapist" name="therapist" label="Therapist" />
      <FormKit type="text" v-model="sessionForm.status" name="status" label="Status" />
    </rs-modal>

    <rs-modal
      :title="isEditAssignment ? 'Edit Assignment' : 'Assign Plan'"
      ok-title="Save"
      cancel-title="Cancel"
      :ok-callback="saveAssignment"
      v-model="showAssignmentModal"
      :overlay-close="false"
    >
      <FormKit type="text" v-model="assignmentForm.patientName" name="patientName" label="Patient Name" />
      <FormKit type="text" v-model="assignmentForm.assignee" name="assignee" label="Assignee" />
      <FormKit type="text" v-model="assignmentForm.assignedBy" name="assignedBy" label="Assigned By" />
      <FormKit type="date" v-model="assignmentForm.date" name="date" label="Date" />
    </rs-modal>

    <rs-modal
      :title="isEditFeedback ? 'Edit Feedback' : 'Add Feedback'"
      ok-title="Save"
      cancel-title="Cancel"
      :ok-callback="saveFeedback"
      v-model="showFeedbackModal"
      :overlay-close="false"
    >
      <FormKit type="text" v-model="feedbackForm.patientName" name="patientName" label="Patient Name" />
      <FormKit type="textarea" v-model="feedbackForm.feedback" name="feedback" label="Feedback" />
      <FormKit type="date" v-model="feedbackForm.date" name="date" label="Date" />
    </rs-modal>
  </div>
</template>