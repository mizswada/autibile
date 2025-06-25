<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const data = ref([]);

const showModalDelete = ref(false);
const showModalDeleteForm = ref({});

const columns = [
  { name: 'parentID', label: 'ID' },
  { name: 'parentRelationship', label: 'Relationship' },
  { name: 'parentGender', label: 'Gender' },
  { name: 'parentDateOfBirth', label: 'Date of Birth' },
  { name: 'parentNationality', label: 'Nationality' },
  { name: 'parentPhone', label: 'Phone' },
  { name: 'parentChildrenNames', label: 'Children Names' },
  { name: 'parentCity', label: 'City' },
  { name: 'parentPostcode', label: 'Postcode' },
  { name: 'parentState', label: 'State' },
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
      // Remove deleted item from table without refetching
      data.value = data.value.filter(p => p.parentID !== showModalDeleteForm.value.parentID);

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
    const [parentRes, relRes, natRes, stateRes] = await Promise.all([
      fetch('/api/parents/listParents'),
      fetch('/api/parents/lookupRelationship'),
      fetch('/api/parents/lookupNationality'),
      fetch('/api/parents/lookupState'),
    ]);

    const result = await parentRes.json();
    const relData = await relRes.json();
    const natData = await natRes.json();
    const stateData = await stateRes.json();

    // Convert lookup arrays to maps for quick lookup
    const relMap = Object.fromEntries(relData.map(item => [item.lookupID, item.title]));
    const natMap = Object.fromEntries(natData.map(item => [item.lookupID, item.title]));
    const stateMap = Object.fromEntries(stateData.map(item => [item.lookupID, item.title]));

    if (result.statusCode === 200) {
      data.value = result.data.map(p => {
        const childNames = [p.parent_add1, p.parent_add2, p.parent_add3]
          .filter(name => !!name && name.trim() !== '')
          .join(', ');

        return {
          parentID: p.parent_id,
          parentRelationship: relMap[p.parent_relationship] || `Unknown (${p.parent_relationship})`,
          parentNationality: natMap[p.parent_nationality] || `Unknown (${p.parent_nationality})`,
          parentPhone: p.parent_phone,
          parentCity: p.parent_city,
          parentChildrenNames: childNames,
          action: 'edit',
        };
      });
    } else {
      console.error('Failed to load parents:', result.message);
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
});

</script>
<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Parents Information</h1>
    <div class="card p-4 mt-4">
      <div class="flex justify-end items-center mb-4">
        <rs-button @click="$router.push('/userManagement/parent/addParents')">
          <Icon name="material-symbols:add" class="mr-1"></Icon>
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
          <div class="flex justify-center items-center space-x-4">
             <!-- Edit Button -->
              <Icon
                name="material-symbols:edit-outline-rounded"
                class="text-primary hover:text-primary/90 cursor-pointer"
                size="22"
                @click="$router.push({ path: '/userManagement/parent/editParent', query: { parentID: data.value.parentID } })"
              />

              <!-- Delete Button -->
              <Icon
                name="material-symbols:close-rounded"
                class="text-primary hover:text-primary/90 cursor-pointer"
                size="22"
                @click="openModalDelete(data.value)"
              />

              <!-- Add Child Button -->
              <rs-button @click="$router.push({ path: '/userManagement/parent/addChild', query: { parentID: data.value.parentID } })">
                <Icon name="material-symbols:add" class="mr-1"></Icon>
                Add Child
              </rs-button>
          </div>
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
