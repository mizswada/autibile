<script setup>
import { ref } from 'vue';
const supportContacts = ref([
  {
    name: "General Support",
    phone: "+6012-3456789",
    email: "support@autibile.com"
  },
  {
    name: "IT Helpdesk",
    phone: "+6011-22334455",
    email: "it@autibile.com"
  },
  {
    name: "Emergency Hotline",
    phone: "+6019-9988776",
    email: "emergency@autibile.com"
  }
]);
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Technical Support</h1>
    <div class="card p-4 mt-4">
      <rs-table
        :data="supportContacts"
        :columns=" [
          { name: 'name', label: 'Support Type' },
          { name: 'contact', label: 'Contact' }
        ]"
        :options="{ borderless: true }"
        advanced
      >
        <template v-slot:contact="slotProps">
          <div>
            <div>
              <a :href="`tel:${slotProps.row.phone}`" class="text-primary underline">
                {{ slotProps.row.phone }}
              </a>
            </div>
            <div>
              <a :href="`mailto:${slotProps.row.email}`" class="text-primary underline">
                {{ slotProps.row.email }}
              </a>
            </div>
          </div>
        </template>
      </rs-table>
    </div>
  </div>
</template>