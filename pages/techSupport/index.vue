<script setup>
import { ref, onMounted } from 'vue'

const supportContacts = ref([])

const fetchContacts = async () => {
  try {
    const res = await fetch('/api/techSupport/list')
    const data = await res.json()
    supportContacts.value = data
  } catch (e) {
    supportContacts.value = []
  }
}

onMounted(fetchContacts)
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Technical Support</h1>
    <div class="card p-4 mt-4">
      <rs-table
        :data="supportContacts"
        :columns=" [
          { name: 'techSupport_name', label: 'Support Type' },
          { name: 'contact', label: 'Contact' }
        ]"
        :options="{ borderless: true }"
        advanced
      >
        <template v-slot:contact="slotProps">
          <div>
            <div>
              <a :href="`tel:${slotProps.row.techSupport_phone}`" class="text-primary underline">
                {{ slotProps.row.techSupport_phone }}
              </a>
            </div>
            <div>
              <a :href="`mailto:${slotProps.row.techSupport_email}`" class="text-primary underline">
                {{ slotProps.row.techSupport_email }}
              </a>
            </div>
          </div>
        </template>
      </rs-table>
    </div>
  </div>
</template>