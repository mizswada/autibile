<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const data = ref([]);
const showModalDelete = ref(false);
const showModalDeleteForm = ref({});

const columns = [
  { name: 'parentID', label: 'ID' },
  { name: 'fullName', label: 'Full Name' },
  { name: 'email', label: 'Email' },
  { name: 'phoneNumber', label: 'Phone' },
  { name: 'icNumber', label: 'IC' },
  { name: 'action', label: 'Actions' }
];

function openModalDelete(value) {
  showModalDeleteForm.value = { ...value };
  showModalDelete.value = true;
}

async function deleteParent() {
  try {
    const parentID = showModalDeleteForm.value.parentID;
    const res = await fetch(`/api/parents/delete?parentID=${parentID}`, {
      method: 'DELETE',
    });

    const result = await res.json();

    if (result.statusCode === 200) {
      data.value = data.value.filter(p => p.parentID !== parentID);
      alert('Parent deleted successfully');
    } else {
      alert(`Error: ${result.message}`);
    }
  } catch (err) {
    console.error('Delete error:', err);
    alert('An error occurred while deleting.');
  } finally {
    showModalDelete.value = false;
  }
}

onMounted(async () => {
  try {
    const res = await fetch('/api/parents/listParents');
    const result = await res.json();

    if (result.statusCode === 200) {
      console.log('Fetched parent list:', result.data); // ✅ log raw data

      data.value = result.data.map(p => {
        return {
          userID: p.userID, // check if this is undefined
          parentID: p.parentID,
          fullName: p.fullName || '',
          email: p.email || '',
          phoneNumber: p.phone || '',
          icNumber: p.ic || '',
          action: 'edit',
          status: p.status || '',
        };
      });

      console.log('Mapped parent data:', data.value); // ✅ log mapped data

    } else {
      console.error('Failed to load parents:', result.message);
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
});


async function toggleStatus(rowData) {
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
      // Update local data state
      const target = data.value.find(p => p.parentID === rowData.parentID);
      if (target) target.status = newStatus;
    } else {
      alert(`Error updating status: ${result.message}`);
    }
  } catch (err) {
    console.error('Status update error:', err);
    alert('An error occurred while updating status.');
  }
}

</script>

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
  background-color: #10b981; /* Tailwind emerald-500 */
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
        :data="data"
        :columns="columns"
        :options="{ variant: 'default', striped: true, borderless: true }"
        :options-advanced="{ sortable: true, responsive: true, filterable: false }"
        advanced
      >
        <template v-slot:action="data">
          <div class="flex justify-center items-center space-x-3 text-gray-600">
            
            <!-- Edit Icon -->
            <span class="relative group cursor-pointer" @click="$router.push({ path: '/userManagement/parent/editParent', query: { parentID: data.value.parentID } })">
              <Icon name="material-symbols:edit" size="22" />
            </span>

            <!-- Add Child Icon -->
            <span
              class="relative group cursor-pointer"
              @click="
                () => {
                  console.log('Going to Add Child with:', data.value);
                  $router.push({
                    path: '/userManagement/parent/addChild',
                    query: {
                      parentID: data.value.parentID,
                      userID: data.value.userID
                    }
                  });
                }
              "
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
            @change="toggleStatus(row.value)"
          />
        </template>

      </rs-table>
    </div>
  </div>

  <rs-modal
    title="Delete Confirmation"
    ok-title="Yes"
    cancel-title="No"
    :ok-callback="deleteParent"
    v-model="showModalDelete"
    :overlay-close="false"
  >
    <p>
      Are you sure you want to delete this parent (ID: {{ showModalDeleteForm.parentID }})?
    </p>
  </rs-modal>
</template>
