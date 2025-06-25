<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const data = ref([]);

const showModalDelete = ref(false);
const showModalDeleteForm = ref({});

const columns = [
  { name: 'parentID', label: 'Parent ID' },
  { name: 'childID', label: 'Child ID' },
  { name: 'nickname', label: 'Nickname' },
  { name: 'gender', label: 'Gender' },
  { name: 'autismDiagnose', label: 'Autism Diagnose' },
  { name: 'diagnosedDate', label: 'Diagnosed Date' },
  { name: 'availableSession', label: 'Available Session' },
  { name: 'status', label: 'Status' },
  { name: 'action', label: 'Actions' }
];

function openModalDelete(value) {
  showModalDeleteForm.value = { ...value };
  showModalDelete.value = true;
}

async function deleteChild() {
  try {
    const childID = showModalDeleteForm.value.childID;
    const res = await fetch(`/api/parents/manageChild/deleteChild?childID=${childID}`, {
      method: 'DELETE',
    });

    const result = await res.json();

    if (result.statusCode === 200) {
      // Remove deleted item from table without refetching
      data.value = data.value.filter(p => p.childID !== showModalDeleteForm.value.childID);

      alert('Child deleted successfully');
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
    const [childRes, availRes] = await Promise.all([
      fetch('/api/parents/manageChild/listChild'),
      fetch('/api/parents/lookupAvailSession'),
    ]);

    const result = await childRes.json();
    const availData = await availRes.json();

    // Convert lookup arrays to maps for quick lookup
    const availMap = Object.fromEntries(availData.map(item => [item.lookupID, item.title]));

    if (result.statusCode === 200) {
      data.value = result.data.map(p => {
      return {
        parentID: p.parentID,                    
        childID: p.childID,                      
        nickname: p.nickname,
        gender: p.gender,
        autismDiagnose: p.autismDiagnose,
        diagnosedDate: new Date(p.diagnosedDate).toISOString().split('T')[0],
        availableSession: availMap[p.availableSession] || `Unknown (${p.availableSession})`,
        status: p.status,
        action: 'edit',
      };
    });

    } else {
      console.error('Failed to load children:', result.message);
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
});

</script>
<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Patients / Children Information</h1>
    <div class="card p-4 mt-4">
      <!-- <div class="flex justify-end items-center mb-4">
        <rs-button @click="$router.push('/userManagement/parent/addChild')">
          <Icon name="material-symbols:add" class="mr-1"></Icon>
          Add Child
        </rs-button>
      </div> -->

      <rs-table
        :data="data"
        :columns="columns"
        :options="{ variant: 'default', striped: true, borderless: true }"
        :options-advanced="{ sortable: true, responsive: true, filterable: false }"
        advanced
      >

        <template v-slot:action="data">
          <div class="flex justify-center items-center space-x-4">
             <!-- Edit Button -->
              <Icon
                name="material-symbols:edit-outline-rounded"
                class="text-primary hover:text-primary/90 cursor-pointer"
                size="22"
                @click="$router.push({ path: '/userManagement/parent/editChild', query: { childID: data.value.childID } })"
              />

              <!-- Delete Button -->
              <Icon
                name="material-symbols:close-rounded"
                class="text-primary hover:text-primary/90 cursor-pointer"
                size="22"
                @click="openModalDelete(data.value)"
              />

          </div>
        </template>
      </rs-table>
    </div>
  </div>

  <!-- Keep delete modal only -->
  <rs-modal
    title="Delete Confirmation"
    ok-title="Yes"
    cancel-title="No"
    :ok-callback="deleteChild"
    v-model="showModalDelete"
    :overlay-close="false"
  >
    <p>
      Are you sure you want to delete this child (ID: {{ showModalDeleteForm.childID }})?
    </p>
  </rs-modal>
</template>
