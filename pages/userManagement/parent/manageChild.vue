<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const rawData = ref([]);
const showModalDelete = ref(false);
const showModalDeleteForm = ref({});
const showConfirmToggleModal = ref(false);
const pendingToggleChild = ref(null);

const columns = [
  { name: 'parentUsername', label: 'Parent Username' },
  { name: 'nickname', label: 'Nickname' },
  { name: 'gender', label: 'Gender' },
  { name: 'autismDiagnose', label: 'Autism Diagnose' },
  { name: 'diagnosedDate', label: 'Diagnosed Date' },
  { name: 'availableSession', label: 'Available Session' },
  { name: 'status', label: 'Status' },
  { name: 'action', label: 'Actions' }
];

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

onMounted(async () => {
  try {
    const [childRes, availRes] = await Promise.all([
      fetch('/api/parents/manageChild/listChild'),
      fetch('/api/parents/lookupAvailSession'),
    ]);

    const result = await childRes.json();
    const availData = await availRes.json();

    const availMap = Object.fromEntries(availData.map(item => [item.lookupID, item.title]));

    if (result.statusCode === 200) {
      rawData.value = result.data.map(p => ({
        parentID: p.parentID,
        childID: p.childID,
        childIC: p.icNumber, // ensure your API returns ic field as 'ic'
        parentUsername: p.parentUsername,
        nickname: p.nickname,
        gender: p.gender,
        autismDiagnose: p.autismDiagnose,
        diagnosedDate: new Date(p.diagnosedDate).toISOString().split('T')[0],
        availableSession: availMap[p.availableSession] || `Unknown (${p.availableSession})`,
        status: p.status,
      }));
    } else {
      console.error('Failed to load children:', result.message);
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
});

const tableData = computed(() =>
  rawData.value.map(p => ({
    parentUsername: p.parentUsername,
    childIC: p.childIC,
    nickname: p.nickname,
    autismDiagnose: p.autismDiagnose,
    diagnosedDate: p.diagnosedDate,
    availableSession: p.availableSession,
    status: p.status,
    action: 'edit',
  }))
);


function getOriginalData(childIC) {
  return rawData.value.find(p => p.childIC === childIC);
}
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Patients / Children Information</h1>
    <div class="card p-4 mt-4">
      <rs-table
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
            @change="confirmToggleStatus(getOriginalData(row.value.childIC))"
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
                const original = getOriginalData(row.value.childIC);
                if (original) {
                  router.push({
                    path: '/userManagement/parent/manageEditChild',
                    query: { childID: original.childID, parentID: original.parentID }
                  });
                }
              }"
            />
          </div>
        </template>
      </rs-table>


    </div>
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

