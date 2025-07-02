<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const rawData = ref([]); // full data including practitionerID
const showModal = ref(false);
const isEdit = ref(false);
const editData = ref(null); // store full data of practitioner for modal
const showConfirmToggleModal = ref(false);
const pendingToggleData = ref(null);
const isLoading = ref(false);
const isSubmitting = ref(false);
const isToggling = ref(false);

const form = ref({
  fullName: '',
  email: '',
  phone: '',
  ic: '',
  type: '',
  registrationNo: '',
  specialty: '',
  department: '',
  qualification: '',
  experience: '',
  signature: '',
  status: '',
});

const isEditing = ref(false);

function enableEdit() {
  isEditing.value = true;
}

function cancelEdit() {
  isEditing.value = false;
  openEditModal(editData.value); // reload original data to discard changes
}

// Status toggle functions
function confirmToggleStatus(row) {
  const original = getOriginalData(row.username);
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
  isToggling.value = true;

  try {
    const response = await $fetch('/api/practitioners/updateStatus', {
      method: 'PUT',
      body: {
        practitionerID: rowData.practitionerID,
        status: newStatus,
      },
    });

    if (response.statusCode === 200) {
      const target = rawData.value.find(p => p.practitionerID === rowData.practitionerID);
      if (target) target.status = newStatus;
      alert(`Status updated to ${newStatus}`);
    } else {
      console.error('Failed to update status:', response.message);
      alert(`Update failed: ${response.message}`);
    }
  } catch (error) {
    console.error('API error:', error);
    alert('An error occurred while updating status.');
  } finally {
    showConfirmToggleModal.value = false;
    pendingToggleData.value = null;
    isToggling.value = false;
  }
}

onMounted(async () => {
  await loadPractitioners();
});

async function loadPractitioners() {
  isLoading.value = true;
  try {
    const response = await $fetch('/api/practitioners/listPractitioners');
    if (response.statusCode === 200) {
      rawData.value = response.data.map(p => ({
        practitionerID: p.practitionerID,
        userID: p.userID,
        username: p.username || '',
        fullName: p.fullName || '',
        email: p.email || '',
        phone: p.phone || '',
        ic: p.ic || '',
        type: p.type || '',
        registrationNo: p.registrationNo || '',
        specialty: p.specialty || '',
        department: p.department || '',
        qualification: p.qualification || '',
        experience: p.experience || '',
        signature: p.signature || '',
        status: p.status || '',
      }));
    } else {
      console.error('Failed to fetch practitioners:', response.message);
    }
  } catch (error) {
    console.error('Error loading practitioners:', error);
  } finally {
    isLoading.value = false;
  }
}

// ✅ Only display needed fields
const tableData = computed(() =>
  rawData.value.map(p => ({
    username: p.username,
    fullName: p.fullName,
    email: p.email,
    phone: p.phone,
    ic: p.ic,
    type: p.type,
    registrationNo: p.registrationNo,
    status: p.status,
    action: 'edit'
  }))
);

function getOriginalData(username) {
  return rawData.value.find(p => p.username === username);
}

function openAddModal() {
  form.value = {
    type: '',
    registrationNo: '',
    specialty: '',
    department: '',
    qualification: '',
    experience: '',
    signature: '',
  };
  isEdit.value = false;
  editData.value = null;
  showModal.value = true;
}

function openEditModal(row) {
  const original = getOriginalData(row.username);
  if (!original) return;

  form.value = {
    fullName: original.fullName || '',
    email: original.email || '',
    phone: original.phone || '',
    ic: original.ic || '',
    type: original.type || '',
    registrationNo: original.registrationNo || '',
    specialty: original.specialty || '',
    department: original.department || '',
    qualification: original.qualification || '',
    experience: original.experience?.toString().replace(/\D/g, '') || '',
    signature: original.signature || '', 
    status: original.status || '',
  };

  isEdit.value = true;
  editData.value = original;
  isEditing.value = false; // Reset editing mode when opening modal
  showModal.value = true;
}

async function savePractitioner() {
  const payload = {
    fullName: form.value.fullName,
    email: form.value.email,
    phone: form.value.phone,
    ic: form.value.ic,
    type: form.value.type,
    registrationNo: form.value.registrationNo,
    specialty: form.value.specialty,
    department: form.value.department,
    qualification: form.value.qualification,
    experience: parseInt(form.value.experience) || 0,
    signature: form.value.signature,
    status: form.value.status,
    userID: editData.value?.userID, 
  };

  isSubmitting.value = true;
  try {
    if (isEdit.value) {
      const response = await $fetch('/api/practitioners/update', {
        method: 'PUT',
        body: {
          practitionerID: editData.value.practitionerID, // use hidden ID
          ...payload,
        },
      });

      if (response.statusCode === 200) {
        await loadPractitioners();
        alert('Practitioner updated successfully');
        showModal.value = false;
        isEditing.value = false; // exit editing mode after save
      } else {
        console.error('Failed to update:', response.message);
        alert(`Update failed: ${response.message}`);
      }
    } else {
      // Your add API (if implemented) would go here
    }
  } catch (error) {
    console.error('API error:', error);
    alert('An error occurred while saving practitioner.');
  } finally {
    isSubmitting.value = false;
  }
}

async function handleSignatureUpload(fileList) {
  const file = fileList?.[0]?.file || fileList?.[0];
  if (file instanceof File) {
    form.value.signature = await fileToBase64(file);
  } else {
    console.warn('No valid file in handleSignatureUpload', fileList);
  }
}


function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

// Watch for modal closing to reset editing state
function onModalClosed() {
  isEditing.value = false;
  showModal.value = false; // This will ensure the modal closes
}

// Add watcher for modal state
watch(() => showModal.value, (newVal) => {
  if (!newVal) {
    isEditing.value = false;
  }
});

</script>

<template>
  <div>
    <h1 class="text-2xl font-bold">Practitioner Management</h1>
    <div class="flex justify-end mb-2">
      <rs-button @click="$router.push('/userManagement/addPractitioners')" class="flex items-center gap-2">
        <Icon name="material-symbols:add" />
          Add Practitioner
      </rs-button>
    </div>

    <div v-if="isLoading" class="flex justify-center my-8">
      <div class="flex flex-col items-center">
        <Icon name="line-md:loading-twotone-loop" size="48" class="text-primary mb-2" />
        <span>Loading practitioners...</span>
      </div>
    </div>

    <rs-table 
      v-else
      :data="tableData" 
      :columns="[
        { name: 'username', label: 'Username' },
        { name: 'fullName', label: 'Full Name' },
        { name: 'email', label: 'Email' },
        { name: 'phone', label: 'Phone' },
        { name: 'ic', label: 'IC' },
        { name: 'type', label: 'Practitioner Type' },
        { name: 'registrationNo', label: 'Registration No' },
        { name: 'status', label: 'Status', slot: true },
        { name: 'action', label: 'Actions', slot: true },
      ]" advanced>
      <template #status="row">
        <input
          type="checkbox"
          class="toggle-checkbox"
          :checked="row.value.status === 'Active'"
          @click.prevent="confirmToggleStatus(row.value)"
        />
      </template>
      
      <template #action="row">
        <div class="flex gap-2">
          <!-- Edit Icon -->
          <span
            class="relative group cursor-pointer"
            @click="() => openEditModal(row.value)"
          >
            <Icon name="material-symbols:edit" size="22" />
          </span>
        </div>
      </template>
    </rs-table>

    <rs-modal
      :title="isEdit ? 'Practitioner Details' : 'Add Practitioner'"
      ok-title="Save"
      cancel-title="Cancel"
      :ok-callback="savePractitioner"
      :cancel-callback="() => onModalClosed()"
      v-model="showModal"
      size="xl"
    >
      <!-- Action buttons for edit/view toggle -->
      <div class="flex justify-end mb-4">
        <rs-button class="flex items-center gap-2" v-if="!isEditing && isEdit" @click="enableEdit"> <Icon name="material-symbols:edit" />Edit Details</rs-button>
        <rs-button class="flex items-center gap-2" v-else-if="isEditing" @click="cancelEdit"> <Icon name="material-symbols:cancel" />Cancel</rs-button>
      </div>

      <!-- Side by side grid layout -->
      <div class="grid grid-cols-2 gap-6">
        <!-- Display each field with beautified design -->
        <div v-for="field in [
          { label: 'Full Name', key: 'fullName' },
          { label: 'Email', key: 'email' },
          { label: 'Phone', key: 'phone' },
          { label: 'IC', key: 'ic' },
          { label: 'Practitioner Type', key: 'type' },
          { label: 'Registration No', key: 'registrationNo' },
          { label: 'Specialty', key: 'specialty' },
          { label: 'Department', key: 'department' },
          { label: 'Qualification', key: 'qualification' },
          { label: 'Experience', key: 'experience' },
          { label: 'Status', key: 'status' },
        ]" :key="field.key" class="flex flex-col gap-1">
          <label class="text-gray-600 text-sm">{{ field.label }}</label>

          <div v-if="!isEditing" class="bg-gray-50 border border-gray-200 rounded px-3 py-2">
            {{ form[field.key] || '-' }}
          </div>

          <FormKit
            v-else
            :type="field.key === 'status' ? 'select' : (field.key === 'type' ? 'select' : 'text')"
            v-model="form[field.key]"
            :name="field.key"
            :placeholder="field.label"
            :options="field.key === 'status' ? ['-- Please select --', 'Active', 'Inactive'] : 
                     (field.key === 'type' ? ['-- Please select --', 'Doctor', 'Therapist'] : undefined)"
          />
        </div>

        <!-- Signature upload and preview spans full width -->
        <div class="col-span-2">
          <label class="text-gray-600 text-sm">Signature</label>
          <div v-if="!isEditing" class="bg-gray-50 border border-gray-200 rounded px-3 py-2">
            <!-- Show image or download link -->
            <div v-if="form.signature">
              <img
                v-if="typeof form.signature === 'string' && form.signature.startsWith('data:image')"
                :src="form.signature"
                alt="Signature Preview"
                class="max-h-32 rounded border"
              />
              <embed
                v-else-if="typeof form.signature === 'string' && form.signature.startsWith('data:application/pdf')"
                :src="form.signature"
                type="application/pdf"
                width="100%"
                height="500px"
              />
              <a
                v-else-if="typeof form.signature === 'string' && form.signature.startsWith('data:')"
                :href="form.signature"
                download="file"
                class="text-blue-600 underline"
              >
                Download file
              </a>
            </div>
            <span v-else class="text-gray-400 italic">No signature uploaded</span>
          </div>

          <FormKit
            v-else
            type="file"
            name="signature"
            label="Upload Signature"
            accept="image/*,application/pdf"
            @input="handleSignatureUpload"
          />
        </div>
      </div>

      <div v-if="isSubmitting" class="flex justify-center items-center mt-4 p-2 bg-blue-50 rounded-md">
        <Icon name="line-md:loading-twotone-loop" class="text-primary mr-2" />
        <span>Updating practitioner details...</span>
      </div>
    </rs-modal>
    
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
        this practitioner (Username: {{ pendingToggleData?.username }})?
      </p>
      
      <div v-if="isToggling" class="flex justify-center items-center mt-4 p-2 bg-blue-50 rounded-md">
        <Icon name="line-md:loading-twotone-loop" class="text-primary mr-2" />
        <span>Updating status...</span>
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
