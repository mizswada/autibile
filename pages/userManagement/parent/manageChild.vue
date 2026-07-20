<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const rawData = ref([]);
const showModalDelete = ref(false);
const showModalDeleteForm = ref({});
const showConfirmToggleModal = ref(false);
const pendingToggleChild = ref(null);
const isLoading = ref(false);
const isTogglingStatus = ref(false);
const message = ref('');
const messageType = ref('success');
const showConfirmRemoveModal = ref(false);
const pendingRemoveChild = ref(null);
const isRemovingChild = ref(false);
const showConfirmMchatrToggleModal = ref(false);
const pendingMchatrToggleChild = ref(null);
const isTogglingMchatrStatus = ref(false);
const showQuestionnaireAccessModal = ref(false);
const pendingAccessChild = ref(null);
const questionnaireAccessList = ref([]);
const isLoadingQuestionnaireAccess = ref(false);
const isTogglingQuestionnaireAccess = ref(false);
const showConfirmAccessToggleModal = ref(false);
const pendingAccessToggleItem = ref(null);

const isUnlockingMchatrOutsideAge = computed(() => {
  const child = pendingMchatrToggleChild.value;
  if (!child) return false;
  return child.mchatrStatus !== 'Enable' && child.mchatrAgeInRange === false;
});

const isUnlockingAccessOutsideAge = computed(() => {
  const item = pendingAccessToggleItem.value;
  if (!item) return false;
  return item.access_status !== 'Enable' && item.age_in_range === false;
});

const columns = [
  { name: 'parentUsername', label: 'Parent Username' },
  { name: 'fullname', label: 'Full Name' },
  // { name: 'nickname', label: 'Nickname' },
  { name: 'gender', label: 'Gender' },
  { name: 'autismDiagnose', label: 'Autism Diagnose' },
  { name: 'diagnosedDate', label: 'Diagnosed Date' },
  { name: 'availableSession', label: 'Available Sessions' },
  { name: 'status', label: 'Status' },
  { name: 'mchatrStatus', label: 'MCHAT-R Status' },
  { name: 'okuCard', label: 'OKU Card' },
  { name: 'treatmentType', label: 'Treatment Type' },
  { name: 'action', label: 'Actions' }
];

function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => (message.value = ''), 3000);
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

function confirmMchatrToggleStatus(child) {
  pendingMchatrToggleChild.value = child;
  showConfirmMchatrToggleModal.value = true;
}

function cancelMchatrToggleStatus() {
  pendingMchatrToggleChild.value = null;
  showConfirmMchatrToggleModal.value = false;
}

async function performMchatrToggleStatus() {
  const child = pendingMchatrToggleChild.value;
  const newMchatrStatus = child.mchatrStatus === 'Enable' ? 'Disable' : 'Enable';
  isTogglingMchatrStatus.value = true;

  try {
    const res = await fetch('/api/questionnaire/patientAccess/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: child.childID,
        questionnaireId: 1,
        accessStatus: newMchatrStatus,
      }),
    });

    const result = await res.json();
    if (result.statusCode === 200) {
      child.mchatrStatus = newMchatrStatus;
      showMessage(`MCHAT-R status updated to ${newMchatrStatus}`, 'success');
    } else {
      showMessage(`Error updating MCHAT-R status: ${result.message}`, 'error');
    }
  } catch (err) {
    console.error('MCHAT-R status update error:', err);
    showMessage('An error occurred while updating MCHAT-R status.', 'error');
  } finally {
    showConfirmMchatrToggleModal.value = false;
    pendingMchatrToggleChild.value = null;
    isTogglingMchatrStatus.value = false;
  }
}

async function openQuestionnaireAccessModal(child) {
  pendingAccessChild.value = child;
  showQuestionnaireAccessModal.value = true;
  isLoadingQuestionnaireAccess.value = true;
  questionnaireAccessList.value = [];

  try {
    const res = await fetch(`/api/questionnaire/patientAccess/list?patientId=${child.childID}`);
    const result = await res.json();
    if (result.statusCode === 200 && result.data?.questionnaires) {
      questionnaireAccessList.value = result.data.questionnaires;
    } else {
      showMessage(result.message || 'Failed to load questionnaire access', 'error');
    }
  } catch (err) {
    console.error('Questionnaire access load error:', err);
    showMessage('An error occurred while loading questionnaire access.', 'error');
  } finally {
    isLoadingQuestionnaireAccess.value = false;
  }
}

function closeQuestionnaireAccessModal() {
  showQuestionnaireAccessModal.value = false;
  pendingAccessChild.value = null;
  questionnaireAccessList.value = [];
}

function confirmQuestionnaireAccessToggle(item) {
  pendingAccessToggleItem.value = item;
  showConfirmAccessToggleModal.value = true;
}

function cancelQuestionnaireAccessToggle() {
  pendingAccessToggleItem.value = null;
  showConfirmAccessToggleModal.value = false;
}

async function performQuestionnaireAccessToggle() {
  const child = pendingAccessChild.value;
  const item = pendingAccessToggleItem.value;
  if (!child || !item) return;

  const newStatus = item.access_status === 'Enable' ? 'Disable' : 'Enable';
  isTogglingQuestionnaireAccess.value = true;

  try {
    const res = await fetch('/api/questionnaire/patientAccess/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: child.childID,
        questionnaireId: item.questionnaire_id,
        accessStatus: newStatus,
      }),
    });

    const result = await res.json();
    if (result.statusCode === 200) {
      const refreshRes = await fetch(
        `/api/questionnaire/patientAccess/list?patientId=${child.childID}`,
      );
      const refreshResult = await refreshRes.json();
      if (refreshResult.statusCode === 200 && refreshResult.data?.questionnaires) {
        questionnaireAccessList.value = refreshResult.data.questionnaires;
        const mchatr = refreshResult.data.questionnaires.find(
          (q) => q.questionnaire_id === 1,
        );
        if (mchatr) {
          child.mchatrStatus = mchatr.access_status;
          child.mchatrAgeInRange = mchatr.age_in_range;
          child.mchatrAgeRangeLabel = mchatr.age_range_label;
        }
      }
      showMessage(`Access updated for "${item.title}"`, 'success');
    } else {
      showMessage(result.message || 'Failed to update access', 'error');
    }
  } catch (err) {
    console.error('Questionnaire access update error:', err);
    showMessage('An error occurred while updating questionnaire access.', 'error');
  } finally {
    showConfirmAccessToggleModal.value = false;
    pendingAccessToggleItem.value = null;
    isTogglingQuestionnaireAccess.value = false;
  }
}

function confirmRemoveChild(child) {
  pendingRemoveChild.value = child;
  showConfirmRemoveModal.value = true;
}

function cancelRemoveChild() {
  pendingRemoveChild.value = null;
  showConfirmRemoveModal.value = false;
}

async function performRemoveChild() {
  const child = pendingRemoveChild.value;
  isRemovingChild.value = true;

  try {
    const res = await fetch(`/api/parents/manageChild/removeChildFromParent?childID=${child.childID}&parentID=${child.parentID}`, {
      method: 'DELETE',
    });

    const result = await res.json();
    if (result.statusCode === 200) {
      // Remove child from list
      rawData.value = rawData.value.filter(c => !(c.childID === child.childID && c.parentID === child.parentID));
      showMessage('Child removed from parent successfully', 'success');
    } else {
      showMessage(`Error removing child: ${result.message}`, 'error');
    }
  } catch (err) {
    console.error('Remove child error:', err);
    showMessage('An error occurred while removing the child.', 'error');
  } finally {
    showConfirmRemoveModal.value = false;
    pendingRemoveChild.value = null;
    isRemovingChild.value = false;
  }
}

onMounted(async () => {
  isLoading.value = true;
  try {
    const childRes = await fetch('/api/parents/manageChild/listChild');
    const result = await childRes.json();

    if (result.statusCode === 200) {
      rawData.value = result.data.map(p => ({
        parentID: p.parentID,
        childID: p.childID,
        childIC: p.icNumber, // ensure your API returns ic field as 'ic'
        parentUsername: p.parentUsername,
        fullname: p.fullname || '',
        // nickname: p.nickname,
        gender: p.gender,
        autismDiagnose: p.autismDiagnose,
        diagnosedDate: new Date(p.diagnosedDate).toISOString().split('T')[0],
        availableSession: p.availableSession || 0, // Use actual session count directly
        status: p.status,
        mchatrStatus: p.mchatr_status || 'Enable', // Default to Enable if not set
        mchatrAgeInRange: p.mchatrAgeInRange,
        mchatrAgeRangeLabel: p.mchatrAgeRangeLabel,
        okuCard: p.okuCard === 1 ? 'Yes' : 'No',
        treatmentType: p.treatmentType || '-',
      }));
    } else {
      console.error('Failed to load children:', result.message);
    }
  } catch (err) {
    console.error('Fetch error:', err);
  } finally {
    isLoading.value = false;
  }
});

const tableData = computed(() =>
  rawData.value.map(p => ({
    parentUsername: p.parentUsername,
    fullname: p.fullname,
    childIC: p.childIC,
    // nickname: p.nickname,
    //autismDiagnose: p.autismDiagnose,
    //diagnosedDate: p.diagnosedDate,
    availableSession: p.availableSession,
    status: p.status,
    mchatrStatus: p.mchatrStatus,
    okuCard: p.okuCard,
    //treatmentType: p.treatmentType,
    action: 'edit',
  }))
);


function getOriginalData(childIC, parentUsername) {
  return rawData.value.find(p => p.childIC === childIC && p.parentUsername === parentUsername);
}
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Patients / Children Information</h1>
    <div class="card p-4 mt-4">
      <!-- Feedback message -->
      <div v-if="message" class="mb-4 p-3 rounded text-white"
           :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
        {{ message }}
      </div>
      
      <div v-if="isLoading" class="flex justify-center my-8">
        <div class="flex flex-col items-center">
          <Icon name="line-md:loading-twotone-loop" size="48" class="text-primary mb-2" />
          <span>Loading children data...</span>
        </div>
      </div>

      <rs-table
        v-else
        :data="tableData"
        :columns="columns"
        :options="{ variant: 'default', striped: true, borderless: true }"
        :options-advanced="{ sortable: true, responsive: true, filterable: false }"
        advanced
      >
        <!-- SLOT for status column -->
        <template v-slot:status="row">
          <input
            type="checkbox"
            class="toggle-checkbox"
            :checked="row.value.status === 'Active'"
            @click.prevent="confirmToggleStatus(getOriginalData(row.value.childIC, row.value.parentUsername))"
          />
        </template>

        <!-- SLOT for MCHAT-R status column -->
        <template v-slot:mchatrStatus="row">
          <input
            type="checkbox"
            class="toggle-checkbox"
            :checked="row.value.mchatrStatus === 'Enable'"
            @click.prevent="confirmMchatrToggleStatus(getOriginalData(row.value.childIC, row.value.parentUsername))"
          />
        </template>

        <!-- SLOT for action column -->
        <template v-slot:action="row">
          <div class="flex justify-center items-center space-x-4">
            <Icon
              name="material-symbols:quiz-outline"
              class="text-blue-600 hover:text-blue-700 cursor-pointer"
              size="22"
              title="Questionnaire access"
              @click="() => {
                const original = getOriginalData(row.value.childIC, row.value.parentUsername);
                if (original) openQuestionnaireAccessModal(original);
              }"
            />
            <Icon
              name="material-symbols:edit-outline-rounded"
              class="text-primary hover:text-primary/90 cursor-pointer"
              size="22"
              @click="() => {
                const original = getOriginalData(row.value.childIC, row.value.parentUsername);
                if (original) {
                  router.push({
                    path: '/userManagement/parent/manageEditChild',
                    query: { childID: original.childID, parentID: original.parentID }
                  });
                }
              }"
            />
            <Icon
              name="material-symbols:delete-outline"
              class="text-red-500 hover:text-red-600 cursor-pointer"
              size="22"
              @click="() => {
                const original = getOriginalData(row.value.childIC, row.value.parentUsername);
                if (original) {
                  confirmRemoveChild(original);
                }
              }"
            />
          </div>
        </template>
      </rs-table>


    </div>
    
    <!-- Toggle Status Modal -->
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
        <span v-if="pendingToggleChild?.status === 'Active'" class="font-semibold text-red-600">deactivate</span>
        <span v-else class="font-semibold text-green-600">activate</span>
        this child <span class="font-semibold">"{{ pendingToggleChild?.fullname }}"</span>?
      </p>
      
      <div class="bg-blue-50 border-l-4 border-blue-400 p-4 my-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <Icon name="material-symbols:info" class="text-blue-400" />
          </div>
          <div class="ml-3">
            <p class="text-sm text-blue-700">
              <span class="font-bold">Child ID:</span> {{ pendingToggleChild?.childID }}<br>
              <span class="font-bold">Parent:</span> {{ pendingToggleChild?.parentUsername }}<br>
              <span class="font-bold">Current Status:</span> {{ pendingToggleChild?.status }}
            </p>
          </div>
        </div>
      </div>

      <div v-if="isTogglingStatus" class="flex justify-center items-center mt-4 p-2 bg-blue-50 rounded-md">
        <Icon name="line-md:loading-twotone-loop" class="text-primary mr-2" />
        <span>Updating status...</span>
      </div>
    </rs-modal>

    <!-- MCHAT-R Toggle Status Modal -->
    <rs-modal
      title="MCHAT-R Status Confirmation"
      :ok-title="isUnlockingMchatrOutsideAge ? 'Yes, unlock anyway' : 'Yes'"
      cancel-title="No"
      :ok-callback="performMchatrToggleStatus"
      :cancel-callback="cancelMchatrToggleStatus"
      v-model="showConfirmMchatrToggleModal"
      :overlay-close="false"
    >
      <p>
        Are you sure you want to
        <span v-if="pendingMchatrToggleChild?.mchatrStatus === 'Enable'" class="font-semibold text-red-600">disable</span>
        <span v-else class="font-semibold text-green-600">enable</span>
        MCHAT-R for child <span class="font-semibold">"{{ pendingMchatrToggleChild?.fullname }}"</span>?
      </p>
      
      <div class="bg-blue-50 border-l-4 border-blue-400 p-4 my-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <Icon name="material-symbols:info" class="text-blue-400" />
          </div>
          <div class="ml-3">
            <p class="text-sm text-blue-700">
              <span class="font-bold">Child ID:</span> {{ pendingMchatrToggleChild?.childID }}<br>
              <span class="font-bold">Parent:</span> {{ pendingMchatrToggleChild?.parentUsername }}<br>
              <span class="font-bold">Current MCHAT-R Status:</span> {{ pendingMchatrToggleChild?.mchatrStatus }}
            </p>
          </div>
        </div>
      </div>

      <div
        v-if="isUnlockingMchatrOutsideAge"
        class="bg-orange-50 border-l-4 border-orange-500 p-4 my-4"
      >
        <div class="flex">
          <div class="flex-shrink-0">
            <Icon name="material-symbols:warning" class="text-orange-500" />
          </div>
          <div class="ml-3">
            <p class="text-sm text-orange-800">
              <strong>Age warning:</strong>
              This child is outside the recommended M-CHAT-R age range
              <span v-if="pendingMchatrToggleChild?.mchatrAgeRangeLabel">
                ({{ pendingMchatrToggleChild.mchatrAgeRangeLabel }})
              </span>.
              Unlocking will let them take the screening anyway. Continue only if you are sure.
            </p>
          </div>
        </div>
      </div>

      <div v-else class="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <Icon name="material-symbols:warning" class="text-yellow-400" />
          </div>
          <div class="ml-3">
            <p class="text-sm text-yellow-700">
              <strong>Note:</strong> This will allow or prevent the child from taking the MCHAT-R autism screening (Questionnaire ID 1).
            </p>
          </div>
        </div>
      </div>

      <div v-if="isTogglingMchatrStatus" class="flex justify-center items-center mt-4 p-2 bg-blue-50 rounded-md">
        <Icon name="line-md:loading-twotone-loop" class="text-primary mr-2" />
        <span>Updating MCHAT-R status...</span>
      </div>
    </rs-modal>

    <!-- Questionnaire Access Modal -->
    <rs-modal
      title="Questionnaire Access"
      ok-title="Close"
      :ok-callback="closeQuestionnaireAccessModal"
      :cancel-callback="closeQuestionnaireAccessModal"
      v-model="showQuestionnaireAccessModal"
      :overlay-close="false"
    >
      <p class="mb-4">
        Manage questionnaire lock/unlock for
        <span class="font-semibold">{{ pendingAccessChild?.fullname }}</span>.
        Locked questionnaires cannot be answered until enabled.
      </p>

      <div v-if="isLoadingQuestionnaireAccess" class="flex justify-center items-center py-6">
        <Icon name="line-md:loading-twotone-loop" class="text-primary mr-2" />
        <span>Loading questionnaire access...</span>
      </div>

      <div v-else class="space-y-3 max-h-96 overflow-y-auto">
        <div
          v-for="item in questionnaireAccessList"
          :key="item.questionnaire_id"
          class="flex items-center justify-between border rounded-lg p-3"
        >
          <div>
            <p class="font-medium">{{ item.title || `Questionnaire ${item.questionnaire_id}` }}</p>
            <p class="text-xs text-gray-500">{{ item.access_reason }}</p>
          </div>
          <input
            type="checkbox"
            class="toggle-checkbox"
            :checked="item.access_status === 'Enable'"
            :disabled="isTogglingQuestionnaireAccess"
            @click.prevent="confirmQuestionnaireAccessToggle(item)"
          />
        </div>
      </div>
    </rs-modal>

    <!-- Questionnaire Access Toggle Confirmation -->
    <rs-modal
      title="Questionnaire Access Confirmation"
      :ok-title="isUnlockingAccessOutsideAge ? 'Yes, unlock anyway' : 'Yes'"
      cancel-title="No"
      :ok-callback="performQuestionnaireAccessToggle"
      :cancel-callback="cancelQuestionnaireAccessToggle"
      v-model="showConfirmAccessToggleModal"
      :overlay-close="false"
    >
      <p>
        Are you sure you want to
        <span v-if="pendingAccessToggleItem?.access_status === 'Enable'" class="font-semibold text-red-600">lock</span>
        <span v-else class="font-semibold text-green-600">unlock</span>
        <span class="font-semibold">"{{ pendingAccessToggleItem?.title }}"</span>
        for
        <span class="font-semibold">"{{ pendingAccessChild?.fullname }}"</span>?
      </p>

      <div
        v-if="isUnlockingAccessOutsideAge"
        class="bg-orange-50 border-l-4 border-orange-500 p-4 my-4"
      >
        <div class="flex">
          <div class="flex-shrink-0">
            <Icon name="material-symbols:warning" class="text-orange-500" />
          </div>
          <div class="ml-3">
            <p class="text-sm text-orange-800">
              <strong>Age warning:</strong>
              This child is outside the recommended age range
              <span v-if="pendingAccessToggleItem?.age_range_label">
                ({{ pendingAccessToggleItem.age_range_label }})
              </span>
              <span v-if="pendingAccessToggleItem?.age_label">
                — currently {{ pendingAccessToggleItem.age_label }} old
              </span>.
              Unlocking will let them take the screening anyway. Continue only if you are sure.
            </p>
          </div>
        </div>
      </div>

      <div v-if="isTogglingQuestionnaireAccess" class="flex justify-center items-center mt-4 p-2 bg-blue-50 rounded-md">
        <Icon name="line-md:loading-twotone-loop" class="text-primary mr-2" />
        <span>Updating access...</span>
      </div>
    </rs-modal>

    <!-- Remove Child Modal -->
    <rs-modal
      title="Remove Child"
      ok-title="Remove"
      cancel-title="Cancel"
      :ok-callback="performRemoveChild"
      :cancel-callback="cancelRemoveChild"
      v-model="showConfirmRemoveModal"
      :overlay-close="false"
    >
      <p>
        Are you sure you want to remove this child <span class="font-semibold">"{{ pendingRemoveChild?.fullname }}"</span> from parent <span class="font-semibold">"{{ pendingRemoveChild?.parentUsername }}"</span>?
      </p>
      <p class="text-sm text-orange-600 mt-2">
        This will only remove the association between the parent and child. The child's record will still exist in the system.
      </p>
      
      <div class="bg-blue-50 border-l-4 border-blue-400 p-4 my-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <Icon name="material-symbols:info" class="text-blue-400" />
          </div>
          <div class="ml-3">
            <p class="text-sm text-blue-700">
              <span class="font-bold">Child ID:</span> {{ pendingRemoveChild?.childID }}<br>
              <span class="font-bold">Parent ID:</span> {{ pendingRemoveChild?.parentID }}<br>
              <span class="font-bold">IC Number:</span> {{ pendingRemoveChild?.childIC }}
            </p>
          </div>
        </div>
      </div>

      <div v-if="isRemovingChild" class="flex justify-center items-center mt-4 p-2 bg-blue-50 rounded-md">
        <Icon name="line-md:loading-twotone-loop" class="text-primary mr-2" />
        <span>Removing child association...</span>
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

