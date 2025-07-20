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

const columns = [
  { name: 'parentUsername', label: 'Parent Username' },
  { name: 'fullname', label: 'Full Name' },
  // { name: 'nickname', label: 'Nickname' },
  { name: 'gender', label: 'Gender' },
  { name: 'autismDiagnose', label: 'Autism Diagnose' },
  { name: 'diagnosedDate', label: 'Diagnosed Date' },
  { name: 'availableSession', label: 'Available Sessions' },
  { name: 'status', label: 'Status' },
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
    autismDiagnose: p.autismDiagnose,
    diagnosedDate: p.diagnosedDate,
    availableSession: p.availableSession,
    status: p.status,
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
            @change="confirmToggleStatus(getOriginalData(row.value.childIC, row.value.parentUsername))"
          />
        </template>

        <!-- SLOT for action column -->
        <template v-slot:action="row">
          <div class="flex justify-center items-center space-x-4">
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

