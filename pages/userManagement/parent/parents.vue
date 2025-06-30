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

onMounted(async () => {
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
  }
});

function getLookupTitle(options, id) {
  const item = options.find(opt => opt.value === id);
  return item ? item.label : '';
}

async function viewParentDetails(rowData) {
  const original = getOriginalData(rowData.username);
  if (!original) return;

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

onMounted(async () => {
  try {
    const res = await fetch('/api/parents/listParents');
    const result = await res.json();

    if (result.statusCode === 200) {
      rawData.value = result.data.map(p => ({
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
      console.error('Failed to load parents:', result.message);
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
});

// ✅ tableData with only display columns
const tableData = computed(() =>
  rawData.value.map(p => ({
    username: p.username,
    fullName: p.fullName,
    email: p.email,
    phoneNumber: p.phoneNumber,
    icNumber: p.icNumber,
    status: p.status,
    action: 'edit' // dummy for action slot
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

      <rs-table
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
  </rs-modal>

  <rs-modal
    title="Parent Details"
    v-model="showViewModal"
    :overlay-close="true"
    size="xl"
  >
    <div v-if="viewData" class="space-y-6">
      <!-- Basic Info -->
      <div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
          <div class="flex">
            <span class="w-40 font-medium">Full Name</span>
            <span class="flex-1 break-words whitespace-pre-line">: {{ viewData.fullName }}</span>
          </div>
          <div class="flex">
            <span class="w-40 font-medium">Email</span>
            <span class="flex-1 break-words whitespace-pre-line">: {{ viewData.email }}</span>
          </div>
          <div class="flex">
            <span class="w-40 font-medium">IC</span>
            <span class="flex-1 break-words whitespace-pre-line">: {{ viewData.ic }}</span>
          </div>
          <div class="flex">
            <span class="w-40 font-medium">Phone</span>
            <span class="flex-1 break-words whitespace-pre-line">: {{ viewData.phone }}</span>
          </div>
          <div class="flex">
            <span class="w-40 font-medium">Relationship</span>
            <span class="flex-1 break-words whitespace-pre-line">: {{ getLookupTitle(relationshipOptions, viewData.relationship) }}</span>
          </div>
          <div class="flex">
            <span class="w-40 font-medium">Gender</span>
            <span class="flex-1 break-words whitespace-pre-line">: {{ viewData.gender }}</span>
          </div>
          <div class="flex">
            <span class="w-40 font-medium">Date of Birth</span>
            <span class="flex-1 break-words whitespace-pre-line">: {{ viewData.dateOfBirth ? new Date(viewData.dateOfBirth).toISOString().split('T')[0] : '' }}</span>
          </div>
          <div class="flex">
            <span class="w-40 font-medium">Nationality</span>
            <span class="flex-1 break-words whitespace-pre-line">: {{ getLookupTitle(nationalityOptions, viewData.nationality) }}</span>
          </div>
        </div>
      </div>

      <!-- Address Info -->
      <div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
          <div class="flex">
            <span class="w-40 font-medium">Address Line 1</span>
            <span class="flex-1 break-words whitespace-pre-line">: {{ viewData.addressLine1 }}</span>
          </div>
          <div class="flex">
            <span class="w-40 font-medium">Address Line 2</span>
            <span class="flex-1 break-words whitespace-pre-line">: {{ viewData.addressLine2 }}</span>
          </div>
          <div class="flex">
            <span class="w-40 font-medium">Address Line 3</span>
            <span class="flex-1 break-words whitespace-pre-line">: {{ viewData.addressLine3 }}</span>
          </div>
          <div class="flex">
            <span class="w-40 font-medium">City</span>
            <span class="flex-1 break-words whitespace-pre-line">: {{ viewData.city }}</span>
          </div>
          <div class="flex">
            <span class="w-40 font-medium">Postcode</span>
            <span class="flex-1 break-words whitespace-pre-line"  >: {{ viewData.postcode }}</span>
          </div>
          <div class="flex">
            <span class="w-40 font-medium">State</span>
            <span class="flex-1 break-words whitespace-pre-line">: {{ getLookupTitle(stateOptions, viewData.state) }}</span>
          </div>
        </div>
      </div>
    </div>
    <!-- modal content here -->
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
