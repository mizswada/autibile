<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const rawData = ref([]); // store full data including IDs
const showConfirmToggleModal = ref(false);
const pendingToggleData = ref(null);
const showViewModal = ref(false);
const viewData = ref(null);
const relationshipOptions = ref([]);
const nationalityOptions = ref([]);
const stateOptions = ref([]);
const isLoading = ref(false);
const isTogglingStatus = ref(false);
const isViewLoading = ref(false);

onMounted(async () => {
  isLoading.value = true;
  try {
    const [parentRes, relRes, natRes, stateRes] = await Promise.all([
      fetch('/api/parents/listParents'),
      fetch('/api/parents/lookupRelationship'),
      fetch('/api/parents/lookupNationality'),
      fetch('/api/parents/lookupState'),
    ]);

    const parentResult = await parentRes.json();
    const relData = await relRes.json();
    const natData = await natRes.json();
    const stateData = await stateRes.json();

    if (parentResult.statusCode === 200) {
      rawData.value = parentResult.data.map(p => ({
        userID: p.userID,
        parentID: p.parentID,
        username: p.username || '',
        fullName: p.fullName || '',
        email: p.email || '',
        phoneNumber: p.phone || '',
        icNumber: p.ic || '',
        status: p.status || '',
      }));
    } else {
      console.error('Failed to load parents:', parentResult.message);
    }

    relationshipOptions.value = relData.map(item => ({
      label: item.title,
      value: item.lookupID
    }));
    nationalityOptions.value = natData.map(item => ({
      label: item.title,
      value: item.lookupID
    }));
    stateOptions.value = stateData.map(item => ({
      label: item.title,
      value: item.lookupID
    }));

  } catch (err) {
    console.error('Fetch error:', err);
  } finally {
    isLoading.value = false;
  }
});

function getLookupTitle(options, id) {
  const item = options.find(opt => opt.value === id);
  return item ? item.label : '';
}

async function viewParentDetails(rowData) {
  const original = getOriginalData(rowData.username);
  if (!original) return;

  isViewLoading.value = true;
  try {
    const res = await fetch(`/api/parents/fetchEdit?parentID=${original.parentID}`);
    const result = await res.json();

    if (result.statusCode === 200) {
      viewData.value = result.data;
      showViewModal.value = true;
    } else {
      alert(`Error fetching details: ${result.message}`);
    }
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
        { label: 'Relationship', key: 'relationship', value: getLookupTitle(relationshipOptions, viewData.relationship) },
        { label: 'Gender', key: 'gender', value: viewData.gender },
        { label: 'Date of Birth', key: 'dateOfBirth', value: viewData.dateOfBirth ? new Date(viewData.dateOfBirth).toISOString().split('T')[0] : '' },
        { label: 'Nationality', key: 'nationality', value: getLookupTitle(nationalityOptions, viewData.nationality) },
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
        { label: 'State', key: 'state', value: getLookupTitle(stateOptions, viewData.state) },
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
