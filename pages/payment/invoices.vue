<script setup>
import { ref, onMounted } from 'vue';

definePageMeta({
  title: "Invoices",
});

const invoices = ref([]);
const loading = ref(true);
const error = ref('');
const selectedStatus = ref('');

// Fetch invoices from API
const fetchInvoices = async (status = '') => {
  loading.value = true;
  error.value = '';
  
  try {
    const query = status ? `?status=${status}` : '';
    const response = await $fetch(`/api/payment/listInvoices${query}`);
    
    if (response.statusCode === 200) {
      invoices.value = response.data;
    } else {
      error.value = response.message || 'Failed to fetch invoices';
    }
  } catch (err) {
    console.error('Error fetching invoices:', err);
    error.value = 'An error occurred while fetching invoices';
  } finally {
    loading.value = false;
  }
};

const filterByStatus = (status) => {
  selectedStatus.value = status;
  fetchInvoices(status);
};

const formatPrice = (price) => {
  return parseFloat(price)
    .toFixed(2)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatInvoiceId = (id) => {
  return `INV-${id.toString().padStart(3, '0')}`;
};

const getStatusBadgeVariant = (status) => {
  return status === 'Paid' ? 'success' : 'warning';
};

onMounted(() => {
  fetchInvoices();
});
</script>

<template>
  <main>
    <LayoutsBreadcrumb />

    <rs-card class="p-6">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
        <h5 class="text-xl font-semibold mb-4 md:mb-0">Invoice Management</h5>
        <div class="flex flex-wrap gap-2">
          <NuxtLink to="/payment/create">
            <rs-button variant="primary" size="sm">
              <NuxtIcon name="ic:outline-add" class="mr-1" />
              Create New Invoice
            </rs-button>
          </NuxtLink>
          <NuxtLink to="/payment">
            <rs-button variant="ghost" size="sm">
              <NuxtIcon name="ic:outline-arrow-back" class="mr-1" />
              Back to Payment
            </rs-button>
          </NuxtLink>
        </div>
      </div>

      <!-- Filter -->
      <div class="flex gap-2 mb-6">
        <rs-button 
          variant="ghost" 
          size="sm"
          :class="selectedStatus === '' ? 'bg-primary text-white' : ''"
          @click="filterByStatus('')"
        >
          All
        </rs-button>
        <rs-button 
          variant="ghost" 
          size="sm"
          :class="selectedStatus === 'Paid' ? 'bg-primary text-white' : ''"
          @click="filterByStatus('Paid')"
        >
          Paid
        </rs-button>
        <rs-button 
          variant="ghost" 
          size="sm"
          :class="selectedStatus === 'Unpaid' ? 'bg-primary text-white' : ''"
          @click="filterByStatus('Unpaid')"
        >
          Unpaid
        </rs-button>
      </div>

      <!-- States -->
      <section v-if="loading" class="flex justify-center items-center py-12">
        <div class="text-center">
          <NuxtIcon name="line-md:loading-twotone-loop" class="text-4xl mb-4" />
          <p>Loading invoices...</p>
        </div>
      </section>

      <section v-else-if="error" class="flex justify-center items-center py-12">
        <div class="text-center text-red-500">
          <NuxtIcon name="ic:outline-error" class="text-4xl mb-4" />
          <p>{{ error }}</p>
          <rs-button @click="fetchInvoices" class="mt-4">
            Try Again
          </rs-button>
        </div>
      </section>

      <section v-else-if="invoices.length === 0" class="flex justify-center items-center py-12">
        <div class="text-center text-gray-500">
          <NuxtIcon name="ic:outline-receipt" class="text-4xl mb-4" />
          <p>No invoices found</p>
          <NuxtLink to="/payment/create">
            <rs-button class="mt-4">
              Create Your First Invoice
            </rs-button>
          </NuxtLink>
        </div>
      </section>

      <!-- Invoices Table -->
      <section v-else>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-200">
                <th class="text-left py-3 px-4 font-medium">Invoice ID</th>
                <th class="text-left py-3 px-4 font-medium">Patient</th>
                <th class="text-left py-3 px-4 font-medium">Invoice Type</th>
                <th class="text-left py-3 px-4 font-medium">Description</th>
                <th class="text-left py-3 px-4 font-medium">Amount</th>
                <th class="text-left py-3 px-4 font-medium">Date</th>
                <th class="text-left py-3 px-4 font-medium">Status</th>
                <th class="text-left py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="invoice in invoices" :key="invoice.invoice_id" class="border-b border-gray-100 hover:bg-gray-50">
                <td class="py-3 px-4">
                  <span class="font-mono text-sm">{{ formatInvoiceId(invoice.invoice_id) }}</span>
                </td>
                <td class="py-3 px-4">
                  <div>
                    <div class="font-medium">{{ invoice.patient_name || 'N/A' }}</div>
                    <div class="text-sm text-gray-500">ID: {{ invoice.patient_id || 'N/A' }}</div>
                  </div>
                </td>
                <td class="py-3 px-4">
                  <span class="text-sm">{{ invoice.invoice_type }}</span>
                </td>
                <td class="py-3 px-4">
                  <span class="text-sm text-gray-600">{{ invoice.description }}</span>
                </td>
                <td class="py-3 px-4">
                  <span class="font-medium text-green-600">RM {{ formatPrice(invoice.amount) }}</span>
                </td>
                <td class="py-3 px-4">
                  <span class="text-sm">{{ formatDate(invoice.date) }}</span>
                </td>
                <td class="py-3 px-4">
                  <rs-badge 
                    :variant="getStatusBadgeVariant(invoice.status)"
                    class="text-xs"
                  >
                    {{ invoice.status }}
                  </rs-badge>
                </td>
                <td class="py-3 px-4">
                  <div class="flex gap-2">
                    <rs-button 
                      variant="outline" 
                      size="sm"
                      @click="() => $router.push(`/payment/viewInvoice/${invoice.invoice_id}`)"
                    >
                      <NuxtIcon name="ic:outline-visibility" class="mr-1" />
                      View
                    </rs-button>
                    <rs-button 
                      variant="outline" 
                      size="sm"
                      @click="() => $router.push(`/payment/editInvoice/${invoice.invoice_id}`)"
                    >
                      <NuxtIcon name="ic:outline-edit" class="mr-1" />
                      Edit
                    </rs-button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </rs-card>
  </main>
</template> 