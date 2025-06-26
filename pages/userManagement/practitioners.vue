<script setup>
import { ref, onMounted } from 'vue';

const practitioners = ref([]);

const showModal = ref(false);
const isEdit = ref(false);
const editId = ref(null);
const form = ref({
  type: '',
  registrationNo: '',
  specialty: '',
  department: '',
  qualification: '',
  experience: '',
  signature: '',
});

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
  editId.value = null;
  showModal.value = true;
}

function openEditModal(practitioner) {
  if (!practitioner) {
    console.error('Practitioner not found');
    return;
  }

  console.log('Opening modal with practitioner:', practitioner);

  form.value = {
    type: practitioner.type || '',
    registrationNo: practitioner.registrationNo || '',
    specialty: practitioner.specialty || '',
    department: practitioner.department || '',
    qualification: practitioner.qualification || '',
    experience: practitioner.experience?.toString().replace(/\D/g, '') || '',
    signature: practitioner.signature || '',
  };

  isEdit.value = true;
  editId.value = practitioner.id;
  showModal.value = true;
}



onMounted(async () => {
  await loadPractitioners();
});

async function loadPractitioners() {
  try {
    const response = await $fetch('/api/practitioners/listPractitioners');

    if (response.statusCode === 200) {
      practitioners.value = response.data.map(p => {
        const practitionerData = {
          id: p.practitioner_id,
          type: p.type,
          registrationNo: p.registration_no,
          specialty: p.specialty,
          department: p.department,
          qualification: p.qualifications,
          experience: `${p.experience_years} Year${p.experience_years > 1 ? 's' : ''}`,
          signature: p.signature,
          action: 'edit',
        };

        return practitionerData;
      });
    } else {
      console.error('Failed to fetch practitioners:', response.message);
    }
  } catch (error) {
    console.error('Error loading practitioners:', error);
  }
}

async function savePractitioner() {
  const isEmpty = (val) =>
    val === null || val === undefined || (typeof val === 'string' && val.trim() === '');

  const requiredFields = {
    type: 'Practitioner Type',
    registrationNo: 'Registration No',
    specialty: 'Specialty',
    department: 'Department',
    qualification: 'Qualification',
    experience: 'Experience',
  };

  const missingFields = [];

  for (const [key, label] of Object.entries(requiredFields)) {
    const value = form.value[key];
    if (isEmpty(value)) {
      missingFields.push(label);
    }
  }

  if (missingFields.length > 0) {
    alert(`Please fill in:\n- ${missingFields.join('\n- ')}`);
    return;
  }

  // Build payload
  const payload = {
    type: form.value.type,
    registrationNo: form.value.registrationNo,
    specialty: form.value.specialty,
    department: form.value.department,
    qualification: form.value.qualification,
    experience: parseInt(form.value.experience),
    signature: '',
  };

  console.log('Current form.signature:', form.value.signature);
  console.log('Is file?', form.value.signature instanceof File);

  // Convert file to base64 if necessary
  if (form.value.signature instanceof File) {
    console.log('[Conversion] Detected file input, converting to base64...');
    const file = form.value.signature;
    const toBase64 = file =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
      });

    try {
      payload.signature = await toBase64(file);
    } catch (error) {
      console.error('Error reading file:', error);
      return;
    }
  } else {
    payload.signature = form.value.signature;
  }


  try {
    // After setting payload.signature
    console.log('Final payload before sending to API:', payload);
    if (isEdit.value) {
      // Call PUT to update
      const response = await $fetch('/api/practitioners/update', {
        method: 'PUT',
        body: {
          practitionerID: editId.value,
          ...payload,
        },
      });

      if (response.statusCode === 200) {
        // Update local list
        const index = practitioners.value.findIndex(p => p.id === editId.value);
        if (index !== -1) {
          practitioners.value[index] = {
            ...practitioners.value[index],
            ...payload,
            experience: `${payload.experience} Year${payload.experience > 1 ? 's' : ''}`,
          };
        }
        alert('Practitioner updated successfully');
        showModal.value = false;
      } else {
        console.error('Failed to update:', response.message);
      }
    } else {
      // Log the payload before sending to API
      console.log('[Insert] Final payload before API call:', payload);

      // Call POST to insert
      const response = await $fetch('/api/practitioners/insert', {
        method: 'POST',
        body: payload,
      });

      if (response.statusCode === 200) {
        const newP = response.data;

        practitioners.value.push({
          id: newP.practitioner_id,
          type: newP.type,
          registrationNo: newP.registration_no,
          specialty: newP.specialty,
          department: newP.department,
          qualification: newP.qualifications,
          experience: `${newP.experience_years} Year${newP.experience_years > 1 ? 's' : ''}`,
          signature: newP.signature,
          action: 'edit',
        });

        alert('Practitioner added successfully');
        showModal.value = false;
      } else {
        console.error('Failed to save:', response.message);
      }
    }
  } catch (error) {
    console.error('API error:', error);
  }
}

async function deletePractitioner(id) {
  if (!confirm('Are you sure you want to delete this practitioner?')) return;

  try {
    const res = await fetch(`/api/practitioners/delete?practitionerID=${id}`, {
      method: 'DELETE',
    });

    const response = await res.json(); 
    if (response.statusCode === 200) {
      practitioners.value = practitioners.value.filter(p => p.id !== id);
      alert('Practitioner deleted successfully');
    } else {
      console.error('Failed to delete:', response.message);
      alert('Failed to delete practitioner.');
    }
  } catch (error) {
    console.error('Delete API error:', error);
    alert('An error occurred while deleting the practitioner.');
  }
}

function handleSignatureUpload(fileList) {
  const file = fileList?.[0]?.file || fileList?.[0];
  if (file instanceof File) {
    form.value.signature = file;
    console.log('[File Upload] File assigned to form.signature:', file);
  } else {
    console.warn('[File Upload] No valid file received:', fileList);
  }
}

</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Practitioner Management</h1>
    <div class="flex justify-end mb-2">
      <rs-button @click="openAddModal">
        <Icon name="material-symbols:add" class="mr-1" />
        Add Practitioner
      </rs-button>
    </div>
    <div class="card p-4 mt-4">
      <rs-table
        :data="practitioners"
        :columns="[
          { name: 'type', label: 'Type' },
          { name: 'registrationNo', label: 'Registration No' },
          { name: 'specialty', label: 'Specialty' },
          { name: 'department', label: 'Department' },
          { name: 'qualification', label: 'Qualification' },
          { name: 'experience', label: 'Experience' },
          { name: 'signature', label: 'Signature', slot: true },
          { name: 'action', label: 'Actions', slot: true }
        ]"
        :options="{ borderless: true }"
        advanced
      >
        <!-- Render signature as <img> -->
        <template #signature="slotProps">
          <div>
            <!-- Show image preview for image types -->
            <img
              v-if="typeof slotProps.value.signature === 'string' && slotProps.value.signature.startsWith('data:image')"
              :src="slotProps.value.signature"
              alt="Signature"
              class="max-h-16 object-contain border rounded"
            />

            <!-- Show download link for other file types -->
            <a
              v-else-if="typeof slotProps.value.signature === 'string' && slotProps.value.signature.startsWith('data:')"
              :href="slotProps.value.signature"
              download="signature"
              class="text-blue-600 underline"
            >
              Download file
            </a>

            <!-- Show fallback if nothing -->
            <span v-else class="text-gray-400 italic">No signature</span>
          </div>
        </template>



        <template #action="slotProps">
          <div class="flex gap-2">
            <rs-button size="sm" @click="() => openEditModal(slotProps.value)">
              <Icon name="material-symbols:edit-outline-rounded" />
            </rs-button>
            <rs-button size="sm" variant="danger" @click="() => deletePractitioner(slotProps.value.id)">
              <Icon name="material-symbols:delete-outline" />
            </rs-button>
          </div>
        </template>
      </rs-table>

    </div>
    <rs-modal
      :title="isEdit ? 'Edit Practitioner' : 'Add Practitioner'"
      ok-title="Save"
      cancel-title="Cancel"
      :ok-callback="savePractitioner"
      v-model="showModal"
      :overlay-close="false"
    >
      <div class="grid grid-cols-2 gap-4">
        <FormKit
          type="select"
          v-model="form.type"
          name="type"
          label="Practitioner Type"
          :options="[
            { label: '-- Please select --', value: '' },
            { label: 'Doctor', value: 'Doctor' },
            { label: 'Therapist', value: 'Therapist' }
          ]"
        />
        <FormKit
          type="text"
          v-model="form.registrationNo"
          name="registrationNo"
          label="Registration No"
        />
        <FormKit
          type="text"
          v-model="form.specialty"
          name="specialty"
          label="Specialty"
        />
        <FormKit
          type="text"
          v-model="form.department"
          name="department"
          label="Department"
        />
        <FormKit
          type="text"
          v-model="form.qualification"
          name="qualification"
          label="Qualification"
        />
        <FormKit
          type="text"
          v-model="form.experience"
          name="experience"
          label="Experience"
          placeholder="e.g. 5"
        />
        <FormKit
          type="file"
          name="signature"
          label="Signature"
          accept="image/*"
          @input="handleSignatureUpload"
        />
      </div>

    </rs-modal>
  </div>
</template>
