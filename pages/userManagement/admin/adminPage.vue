<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const rawData = ref([]); // store full data including IDs
const showConfirmToggleModal = ref(false);
const pendingToggleData = ref(null);
const showViewModal = ref(false);
const viewData = ref(null);
const isLoading = ref(false);
const isViewLoading = ref(false);
const isTogglingStatus = ref(false);

onMounted(async () => {
  await loadAdmins();
});

async function loadAdmins() {
  isLoading.value = true;
  try {
    const res = await fetch('/api/admin/listAdmins');
    const result = await res.json();

    if (result.statusCode === 200) {
      rawData.value = result.data.map(admin => ({
        userID: admin.userID,
        username: admin.username || '',
        fullName: admin.fullName || '',
        email: admin.email || '',
        phone: admin.phone || '',
        ic: admin.ic || '',
        status: admin.status || '',
        role: admin.role || '',
      }));
    } else {
      console.error('Failed to load administrators:', result.message);
    }
  } catch (err) {
    console.error('Fetch error:', err);
  } finally {
    isLoading.value = false;
  }
}

async function viewAdminDetails(rowData) {
  const original = getOriginalData(rowData.username);
  if (!original) return;

  isViewLoading.value = true;
  try {
    const res = await fetch(`/api/admin/fetchAdmin?userID=${original.userID}`);
    const result = await res.json();

    if (result.statusCode === 200) {
      viewData.value = result.data;
      showViewModal.value = true;
    } else {
      alert(`Error fetching details: ${result.message}`);
    }
  } catch (err) {
    console.error('View admin error:', err);
    alert('An error occurred while fetching administrator details.');
  } finally {
    isViewLoading.value = false;
  }
}

const columns = [
  { name: 'username', label: 'Username' },
  { name: 'fullName', label: 'Full Name' },
  { name: 'email', label: 'Email' },
  { name: 'phone', label: 'Phone' },
  { name: 'ic', label: 'IC' },
  { name: 'role', label: 'Role' },
  { name: 'status', label: 'Status', slot: true },
  { name: 'action', label: 'Actions', slot: true }
];

// ✅ tableData with only display columns
const tableData = computed(() =>
  rawData.value.map(p => ({
    username: p.username,
    fullName: p.fullName,
    email: p.email,
    phone: p.phone,
    ic: p.ic,
    role: p.role,
    status: p.status,
    action: 'edit'
  }))
);

function getOriginalData(username) {
  return rawData.value.find(p => p.username === username);
}

function confirmToggleStatus(rowData) {
  const original = getOriginalData(rowData.username);
  if (original) {
    pendingToggleData.value = original;
    showConfirmToggleModal.value = true;
  }
}

function cancelToggleStatus() {
  pendingToggleData.value = null;
  showConfirmToggleModal.value = false;
}

async function performToggleStatus() {
  const rowData = pendingToggleData.value;
  const newStatus = rowData.status === 'Active' ? 'Inactive' : 'Active';
  isTogglingStatus.value = true;

  try {
    const res = await fetch('/api/admin/updateAdminStatus', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userID: rowData.userID,
        status: newStatus,
      }),
    });

    const result = await res.json();

    if (result.statusCode === 200) {
      const target = rawData.value.find(p => p.userID === rowData.userID);
      if (target) target.status = newStatus;
    } else {
      alert(`Error updating status: ${result.message}`);
    }
  } catch (err) {
    console.error('Status update error:', err);
    alert('An error occurred while updating status.');
  } finally {
    showConfirmToggleModal.value = false;
    pendingToggleData.value = null;
    isTogglingStatus.value = false;
  }
}
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Administrators</h1>
    <div class="card p-4 mt-4">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2 md:gap-4">
        <div class="text-sm text-blue-600 bg-blue-50 border border-blue-200 px-3 py-2 rounded-md flex items-center">
          <Icon name="material-symbols:info" class="mr-2 text-blue-500" />
          This page displays all administrators in the system.
        </div>

        <rs-button @click="$router.push('/userManagement/admin/addAdmin')" class="flex items-center gap-2">
          <Icon name="material-symbols:add" />
          Add Administrator
        </rs-button>
      </div>

      <div v-if="isLoading" class="flex justify-center my-8">
        <div class="flex flex-col items-center">
          <Icon name="line-md:loading-twotone-loop" size="48" class="text-primary mb-2" />
          <span>Loading administrators...</span>
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
        <template v-slot:action="row">
          <div class="flex justify-center items-center space-x-3 text-gray-600">
            <!-- View Icon -->
            <span
              class="relative group cursor-pointer"
              @click="() => viewAdminDetails(row.value)"
            >
              <Icon name="material-symbols:visibility" size="22" />
            </span>

            <!-- Edit Icon -->
            <span
              class="relative group cursor-pointer"
              @click="() => {
                const original = getOriginalData(row.value.username);
                if (original) {
                  $router.push({ path: '/userManagement/admin/editAdmin', query: { userID: original.userID } });
                }
              }"
            >
              <Icon name="material-symbols:edit" size="22" />
            </span>
          </div>
        </template>

        <template v-slot:status="row">
          <input
            type="checkbox"
            class="toggle-checkbox"
            :checked="row.value.status === 'Active'"
            @click.prevent="confirmToggleStatus(row.value)"
          />
        </template>
      </rs-table>
    </div>
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
      <span v-if="pendingToggleData?.status === 'Active'">deactivate</span>
      <span v-else>activate</span>
      this administrator (Username: {{ pendingToggleData?.username }})?
    </p>
    
    <div v-if="isTogglingStatus" class="flex justify-center items-center mt-4 p-2 bg-blue-50 rounded-md">
      <Icon name="line-md:loading-twotone-loop" class="text-primary mr-2" />
      <span>Updating status...</span>
    </div>
  </rs-modal>

  <rs-modal
    title="Administrator Details"
    v-model="showViewModal"
    :overlay-close="true"
    size="xl"
  >
    <div v-if="isViewLoading" class="flex justify-center my-8">
      <div class="flex flex-col items-center">
        <Icon name="line-md:loading-twotone-loop" size="48" class="text-primary mb-2" />
        <span>Loading administrator details...</span>
      </div>
    </div>

    <div v-else-if="viewData" class="grid grid-cols-2 gap-6">
      <!-- Basic Information -->
      <div v-for="field in [
        { label: 'Username', key: 'username', value: viewData.username },
        { label: 'Full Name', key: 'fullName', value: viewData.fullName },
        { label: 'Email', key: 'email', value: viewData.email },
        { label: 'Phone', key: 'phone', value: viewData.phone },
        { label: 'IC', key: 'ic', value: viewData.ic },
      ]" :key="field.key" class="flex flex-col gap-1">
        <label class="text-gray-600 text-sm">{{ field.label }}</label>
        <div class="bg-gray-50 border border-gray-200 rounded px-3 py-2">
          {{ field.value || '-' }}
        </div>
      </div>

      <!-- Roles heading -->
      <div class="col-span-2 mt-4">
        <h3 class="font-semibold text-gray-700 border-b pb-2">Roles</h3>
      </div>

      <!-- Roles display -->
      <div class="col-span-2">
        <div class="flex flex-wrap gap-2 mt-2">
          <span 
            v-for="role in viewData.roles" 
            :key="role.id"
            class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
          >
            {{ role.name }}
          </span>
        </div>
      </div>

      <!-- Status field -->
      <div class="flex flex-col gap-1">
        <label class="text-gray-600 text-sm">Status</label>
        <div class="bg-gray-50 border border-gray-200 rounded px-3 py-2 flex items-center">
          <input
            type="checkbox"
            class="toggle-checkbox mr-2"
            :checked="viewData.status === 'Active'"
            disabled
          />
          {{ viewData.status }}
        </div>
      </div>
    </div>
    
    <!-- Footer with close button -->
    <template #footer>
      <rs-button @click="showViewModal = false">Close</rs-button>
    </template>
  </rs-modal>
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
