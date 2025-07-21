<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';

definePageMeta({
  title: "View Invoice",
});

const router = useRouter();
const route = useRoute();
const isLoading = ref(true);
const message = ref('');
const messageType = ref('success');
const isUpdating = ref(false);
const invoiceId = route.params.id;
const invoiceData = ref(null);

function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => (message.value = ''), 3000);
}

const fetchInvoice = async () => {
  isLoading.value = true;
  try {
    const response = await $fetch(`/api/payment/getInvoice/${invoiceId}`);
    if (response.statusCode === 200) {
      invoiceData.value = response.data;
    } else {
      showMessage('Failed to load invoice data', 'error');
      router.push('/payment/invoices');
    }
  } catch (error) {
    console.error('Error fetching invoice:', error);
    showMessage('An error occurred while loading the invoice', 'error');
    router.push('/payment/invoices');
  } finally {
    isLoading.value = false;
  }
};

const updateStatus = async (newStatus) => {
  if (!confirm(`Are you sure you want to mark this invoice as ${newStatus}?`)) {
    return;
  }

  isUpdating.value = true;
  try {
    const response = await $fetch('/api/payment/updateInvoiceStatus', {
      method: 'PUT',
      body: {
        invoiceID: parseInt(invoiceId),
        status: newStatus,
      },
    });

    if (response.statusCode === 200) {
      showMessage(`Invoice status updated to ${newStatus} successfully`, 'success');
      
      // If it's a package and status is Paid, show session addition message
      if (newStatus === 'Paid' && response.data.available_sessions !== undefined) {
        showMessage(`Added sessions to patient. New available sessions: ${response.data.available_sessions}`, 'success');
      }
      
      // Refresh invoice data
      await fetchInvoice();
    } else {
      showMessage(response.message || 'Failed to update invoice status', 'error');
    }
  } catch (error) {
    console.error('Error updating invoice status:', error);
    showMessage(error.data?.message || 'An error occurred while updating the invoice status', 'error');
  } finally {
    isUpdating.value = false;
  }
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
    month: 'long',
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
  fetchInvoice();
});
</script>

<template>
  <main>
    <LayoutsBreadcrumb />

    <rs-card class="p-6">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
        <h5 class="text-xl font-semibold mb-4 md:mb-0">Invoice Details</h5>
        <div class="flex flex-wrap gap-2">
          <NuxtLink to="/payment/invoices">
            <rs-button variant="ghost" size="sm">
              <NuxtIcon name="ic:outline-arrow-back" class="mr-1" />
              Back to Invoices
            </rs-button>
          </NuxtLink>
          <NuxtLink :to="`/payment/editInvoice/${invoiceId}`">
            <rs-button variant="outline" size="sm">
              <NuxtIcon name="ic:outline-edit" class="mr-1" />
              Edit Invoice
            </rs-button>
          </NuxtLink>
        </div>
      </div>

      <!-- Loading State -->
      <section v-if="isLoading" class="flex justify-center items-center py-12">
        <div class="text-center">
          <NuxtIcon name="line-md:loading-twotone-loop" class="text-4xl mb-4" />
          <p>Loading invoice details...</p>
        </div>
      </section>

      <!-- Invoice Details -->
      <section v-else-if="invoiceData" class="space-y-6">
        <!-- Invoice Header -->
        <div class="bg-gray-50 p-6 rounded-lg">
          <div class="flex justify-between items-start">
            <div>
              <h6 class="text-2xl font-bold text-gray-800">{{ formatInvoiceId(invoiceData.invoice_id) }}</h6>
              <p class="text-gray-600 mt-1">{{ formatDate(invoiceData.date) }}</p>
            </div>
            <div class="text-right">
              <rs-badge 
                :variant="getStatusBadgeVariant(invoiceData.status)"
                class="text-sm mb-2"
              >
                {{ invoiceData.status }}
              </rs-badge>
              <div class="text-3xl font-bold text-green-600">
                RM {{ formatPrice(invoiceData.amount) }}
              </div>
            </div>
          </div>
        </div>

        <!-- Invoice Information -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Patient Information -->
          <div class="bg-white border border-gray-200 p-6 rounded-lg">
            <h6 class="font-semibold text-lg mb-4 text-gray-800">Patient Information</h6>
            <div class="space-y-3">
              <div>
                <span class="text-sm text-gray-500">Patient Name:</span>
                <div class="font-medium">{{ invoiceData.patient_name || 'N/A' }}</div>
              </div>
              <div>
                <span class="text-sm text-gray-500">Patient ID:</span>
                <div class="font-medium">{{ invoiceData.patient_id || 'N/A' }}</div>
              </div>
            </div>
          </div>

          <!-- Invoice Details -->
          <div class="bg-white border border-gray-200 p-6 rounded-lg">
            <h6 class="font-semibold text-lg mb-4 text-gray-800">Invoice Details</h6>
            <div class="space-y-3">
              <div>
                <span class="text-sm text-gray-500">Invoice Type:</span>
                <div class="font-medium">{{ invoiceData.invoice_type }}</div>
              </div>
              <div>
                <span class="text-sm text-gray-500">Description:</span>
                <div class="font-medium">{{ invoiceData.description }}</div>
              </div>
              <div>
                <span class="text-sm text-gray-500">Amount:</span>
                <div class="font-medium text-green-600">RM {{ formatPrice(invoiceData.amount) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Status Management -->
        <div class="bg-white border border-gray-200 p-6 rounded-lg">
          <h6 class="font-semibold text-lg mb-4 text-gray-800">Status Management</h6>
          <div class="flex gap-4">
            <rs-button 
              v-if="invoiceData.status === 'Unpaid'"
              variant="success" 
              size="sm"
              :disabled="isUpdating"
              @click="updateStatus('Paid')"
            >
              <NuxtIcon v-if="isUpdating" name="line-md:loading-twotone-loop" class="mr-2" />
              <span>{{ isUpdating ? 'Updating...' : 'Mark as Paid' }}</span>
            </rs-button>
            <rs-button 
              v-if="invoiceData.status === 'Paid'"
              variant="warning" 
              size="sm"
              :disabled="isUpdating"
              @click="updateStatus('Unpaid')"
            >
              <NuxtIcon v-if="isUpdating" name="line-md:loading-twotone-loop" class="mr-2" />
              <span>{{ isUpdating ? 'Updating...' : 'Mark as Unpaid' }}</span>
            </rs-button>
          </div>
          <p class="text-sm text-gray-600 mt-2">
            <strong>Note:</strong> When marking a package invoice as "Paid", the available sessions will be automatically added to the patient's account.
          </p>
        </div>

        <!-- Timestamps -->
        <div class="bg-gray-50 p-4 rounded-lg">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-gray-500">Created:</span>
              <span class="ml-2">{{ formatDate(invoiceData.created_at) }}</span>
            </div>
            <div>
              <span class="text-gray-500">Last Updated:</span>
              <span class="ml-2">{{ formatDate(invoiceData.update_at) }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Error State -->
      <section v-else class="flex justify-center items-center py-12">
        <div class="text-center text-red-500">
          <NuxtIcon name="ic:outline-error" class="text-4xl mb-4" />
          <p>Failed to load invoice details</p>
          <rs-button @click="fetchInvoice" class="mt-4">
            Try Again
          </rs-button>
        </div>
      </section>

      <!-- Message Display -->
      <div v-if="message" class="mt-4 p-3 rounded text-white"
           :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
        {{ message }}
      </div>
    </rs-card>
  </main>
</template> 