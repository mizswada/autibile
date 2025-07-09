<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const rawData = ref([]);
const showConfirmToggleModal = ref(false);
const pendingToggleData = ref(null);
const showViewModal = ref(false);
const viewData = ref(null);
const isLoading = ref(false);
const isTogglingStatus = ref(false);
const isViewLoading = ref(false);

// Add delete functionality
const showDeleteModal = ref(false);
const pendingDeleteData = ref(null);
const isDeleting = ref(false);

onMounted(async () => {
  isLoading.value = true;
  try {
    const parentRes = await fetch('/api/parents/listParents');
    const parentResult = await parentRes.json();

    if (parentResult.statusCode === 200) {
      rawData.value = parentResult.data.map(p => ({
        userID: p.userID,
        parentID: p.parentID,
        username: p.username || '',
        fullName: p.fullName || '',
        email: p.email || '',
        phoneNumber: p.phone || '',
        icNumber: p.ic || '',
        relationship: p.relationship || '',
        nationality: p.nationality || '',
        state: p.state || '',
        status: p.status || '',

        // Added fields
        gender: p.gender || '',
        dateOfBirth: p.dateOfBirth || '',
        addressLine1: p.addressLine1 || '',
        addressLine2: p.addressLine2 || '',
        addressLine3: p.addressLine3 || '',
        city: p.city || '',
        postcode: p.postcode || '',
      }));

    } else {
      console.error('Failed to load parents:', parentResult.message);
    }
  } catch (err) {
    console.error('Fetch error:', err);
  } finally {
    isLoading.value = false;
  }
});

async function viewParentDetails(rowData) {
  const original = getOriginalData(rowData.username);
  if (!original) return;

  isViewLoading.value = true;
  try {
    // Directly assign from local data
    viewData.value = {
      parentID: original.parentID,
      fullName: original.fullName,
      email: original.email,
      ic: original.icNumber,
      phone: original.phoneNumber,
      relationship: original.relationship,
      gender: original.gender,
      dateOfBirth: original.dateOfBirth,
      nationality: original.nationality,
      addressLine1: original.addressLine1,
      addressLine2: original.addressLine2,
      addressLine3: original.addressLine3,
      city: original.city,
      postcode: original.postcode,
      state: original.state,
      status: original.status,
    };
    console.log(viewData.value);
    showViewModal.value = true;
  } catch (err) {
    console.error('View parent error:', err);
    alert('An error occurred while fetching parent details.');
  } finally {
    isViewLoading.value = false;
  }
}

const columns = [
  { name: 'username', label: 'Username' },
  { name: 'fullName', label: 'Full Name' },
  { name: 'email', label: 'Email' },
  { name: 'phoneNumber', label: 'Phone' },
  { name: 'icNumber', label: 'IC' },
  { name: 'status', label: 'Status' },
  { name: 'action', label: 'Actions' }
];

const tableData = computed(() =>
  rawData.value.map(p => ({
    username: p.username,
    fullName: p.fullName,
    email: p.email,
    phoneNumber: p.phoneNumber,
    icNumber: p.icNumber,
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
    const res = await fetch('/api/parents/updateStatus', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentID: rowData.parentID,
        status: newStatus,
      }),
    });

    const result = await res.json();

    if (result.statusCode === 200) {
      const target = rawData.value.find(p => p.parentID === rowData.parentID);
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

// Delete functionality
function confirmDelete(rowData) {
  const original = getOriginalData(rowData.username);
  if (original) {
    pendingDeleteData.value = original;
    showDeleteModal.value = true;
  }
}

function cancelDelete() {
  pendingDeleteData.value = null;
  showDeleteModal.value = false;
}

async function performDelete() {
  const rowData = pendingDeleteData.value;
  isDeleting.value = true;

  try {
    const res = await fetch(`/api/parents/delete?parentID=${rowData.parentID}`, {
      method: 'DELETE'
    });

    const result = await res.json();

    if (result.statusCode === 200) {
      // Remove the deleted parent from the list
      rawData.value = rawData.value.filter(p => p.parentID !== rowData.parentID);
      alert('Parent deleted successfully');
    } else {
      alert(`Error deleting parent: ${result.message}`);
    }
  } catch (err) {
    console.error('Delete error:', err);
    alert('An error occurred while deleting the parent.');
  } finally {
    showDeleteModal.value = false;
    pendingDeleteData.value = null;
    isDeleting.value = false;
  }
}
</script>


<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Parents Information</h1>
    <div class="card p-4 mt-4">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2 md:gap-4">
        <div class="text-sm text-orange-600 bg-orange-50 border border-orange-200 px-3 py-2 rounded-md flex items-center">
          <Icon name="material-symbols:warning" class="mr-2 text-orange-500" />
          Please update children information via the Action column.
        </div>

        <rs-button @click="$router.push('/userManagement/parent/addParents')" class="flex items-center gap-2">
          <Icon name="material-symbols:add" />
          Add Parent
        </rs-button>
      </div>

      <div v-if="isLoading" class="flex justify-center my-8">
        <div class="flex flex-col items-center">
          <Icon name="line-md:loading-twotone-loop" size="48" class="text-primary mb-2" />
          <span>Loading parents data...</span>
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
              @click="() => viewParentDetails(row.value)"
            >
              <Icon name="material-symbols:visibility" size="22" />
            </span>

            <!-- Edit Icon -->
            <span
              class="relative group cursor-pointer"
              @click="() => {
                const original = getOriginalData(row.value.username);
                if (original) {
                  $router.push({ path: '/userManagement/parent/editParent', query: { parentID: original.parentID } });
                }
              }"
            >
              <Icon name="material-symbols:edit" size="22" />
            </span>

            <!-- Add Child Icon -->
            <span
              class="relative group cursor-pointer"
              @click="() => {
                const original = getOriginalData(row.value.username);
                if (original) {
                  $router.push({
                    path: '/userManagement/parent/addChild',
                    query: { parentID: original.parentID, userID: original.userID }
                  });
                }
              }"
            >
              <Icon name="material-symbols:group-add-rounded" size="22" />
            </span>
            
            <!-- Delete Icon -->
            <span
              class="relative group cursor-pointer text-red-500 hover:text-red-700"
              @click="() => confirmDelete(row.value)"
            >
              <Icon name="material-symbols:delete-outline" size="22" />
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
      this parent (Username: {{ pendingToggleData?.username }})?
    </p>

    <div v-if="isTogglingStatus" class="flex justify-center items-center mt-4 p-2 bg-blue-50 rounded-md">
      <Icon name="line-md:loading-twotone-loop" class="text-primary mr-2" />
      <span>Updating status...</span>
    </div>
  </rs-modal>
  
  <!-- Delete confirmation modal -->
  <rs-modal
    title="Delete Parent"
    ok-title="Delete"
    cancel-title="Cancel"
    :ok-callback="performDelete"
    :cancel-callback="cancelDelete"
    v-model="showDeleteModal"
    :overlay-close="false"
  >
    <p class="mb-4">
      Are you sure you want to delete this parent ({{ pendingDeleteData?.fullName }})?
    </p>
    <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <Icon name="material-symbols:warning" class="text-yellow-400" />
        </div>
        <div class="ml-3">
          <p class="text-sm text-yellow-700">
            This will also delete all associated children records. This action cannot be undone.
          </p>
        </div>
      </div>
    </div>

    <div v-if="isDeleting" class="flex justify-center items-center mt-4 p-2 bg-blue-50 rounded-md">
      <Icon name="line-md:loading-twotone-loop" class="text-primary mr-2" />
      <span>Deleting...</span>
    </div>
  </rs-modal>

  <rs-modal
    title="Parent Details"
    v-model="showViewModal"
    :overlay-close="true"
    size="xl"
  >
    <div v-if="isViewLoading" class="flex justify-center my-8">
      <div class="flex flex-col items-center">
        <Icon name="line-md:loading-twotone-loop" size="48" class="text-primary mb-2" />
        <span>Loading parent details...</span>
      </div>
    </div>

    <div v-else-if="viewData" class="grid grid-cols-2 gap-6">
      <!-- Basic Information -->
      <div v-for="field in [
        { label: 'Full Name', key: 'fullName', value: viewData.fullName },
        { label: 'Email', key: 'email', value: viewData.email },
        { label: 'IC', key: 'ic', value: viewData.ic },
        { label: 'Phone', key: 'phone', value: viewData.phone },
        { label: 'Relationship', key: 'relationship', value: viewData.relationship },
        { label: 'Gender', key: 'gender', value: viewData.gender },
        { label: 'Date of Birth', key: 'dateOfBirth', value: viewData.dateOfBirth ? new Date(viewData.dateOfBirth).toISOString().split('T')[0] : '' },
        { label: 'Nationality', key: 'nationality', value: viewData.nationality },
      ]" :key="field.key" class="flex flex-col gap-1">
        <label class="text-gray-600 text-sm">{{ field.label }}</label>
        <div class="bg-gray-50 border border-gray-200 rounded px-3 py-2">
          {{ field.value || '-' }}
        </div>
      </div>

      <!-- Address Information heading -->
      <div class="col-span-2 mt-4">
        <h3 class="font-semibold text-gray-700 border-b pb-2">Address Information</h3>
      </div>

      <!-- Address fields -->
      <div v-for="field in [
        { label: 'Address Line 1', key: 'addressLine1', value: viewData.addressLine1 },
        { label: 'Address Line 2', key: 'addressLine2', value: viewData.addressLine2 },
        { label: 'Address Line 3', key: 'addressLine3', value: viewData.addressLine3 },
        { label: 'City', key: 'city', value: viewData.city },
        { label: 'Postcode', key: 'postcode', value: viewData.postcode },
        { label: 'State', key: 'state', value: viewData.state },
        { label: 'Status', key: 'status', value: viewData.status },
      ]" :key="field.key" class="flex flex-col gap-1">
        <label class="text-gray-600 text-sm">{{ field.label }}</label>
        <div class="bg-gray-50 border border-gray-200 rounded px-3 py-2">
          {{ field.value || '-' }}
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
