<script setup>
import { ref, onMounted, computed } from 'vue';
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

const hasPendingPayment = computed(() => invoiceData.value?.latest_payment?.status === "Pending");
const isVoid = computed(() => invoiceData.value?.status === "Void");

// Void an unpaid invoice (appointments it billed go back to "unbilled").
const voidInvoice = async () => {
  const reason = prompt('Why is this invoice being voided? (required)');
  if (reason === null) return;
  if (reason.trim().length < 3) {
    showMessage('A reason is required to void an invoice.', 'error');
    return;
  }
  if (!confirm('Void this invoice? Any appointments it bills go back to the To Bill list, and a pending parent payment is rejected.')) {
    return;
  }

  isUpdating.value = true;
  try {
    const response = await $fetch('/api/payment/voidInvoice', {
      method: 'PUT',
      body: { invoiceID: parseInt(invoiceId), reason: reason.trim() },
    });

    if (response.statusCode === 200) {
      showMessage('Invoice voided', 'success');
      await fetchInvoice();
    } else {
      showMessage(response.message || 'Failed to void the invoice', 'error');
    }
  } catch (error) {
    console.error('Error voiding invoice:', error);
    showMessage(error.data?.message || 'An error occurred while voiding the invoice', 'error');
  } finally {
    isUpdating.value = false;
  }
};

const formatShortDate = (value) =>
  new Date(value).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });

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

// Legacy only: an invoice that was marked Paid by hand (no payment, no sessions) can go back to Unpaid.
const markUnpaid = async () => {
  if (!confirm('Mark this invoice as Unpaid?')) {
    return;
  }

  isUpdating.value = true;
  try {
    const response = await $fetch('/api/payment/updateInvoiceStatus', {
      method: 'PUT',
      body: { invoiceID: parseInt(invoiceId), status: 'Unpaid' },
    });

    if (response.statusCode === 200) {
      showMessage('Invoice marked as Unpaid', 'success');
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

// Full refund of a paid invoice: the money is handed back outside the system.
const refundInvoice = async () => {
  const takeBack = invoiceData.value?.sessions_to_take_back || 0;
  const reason = prompt('Why is this invoice being refunded? (required)');
  if (reason === null) return;
  if (reason.trim().length < 3) {
    showMessage('A reason is required to refund an invoice.', 'error');
    return;
  }

  const balance = invoiceData.value?.patient_balance ?? 0;
  const lines = [
    'Refund this invoice in full?',
    '',
    `- The invoice becomes void and its payment is marked Refunded.`,
    takeBack > 0
      ? `- ${takeBack} session(s) are taken back (balance ${balance} -> ${balance - takeBack}).`
      : '- No sessions are taken back.',
    '- Appointments it billed go back to the To Bill list.',
    '',
    'Hand the money back to the parent separately. This cannot be undone.',
  ];
  if (!confirm(lines.join('\n'))) {
    return;
  }

  isUpdating.value = true;
  try {
    const response = await $fetch('/api/payment/refundInvoice', {
      method: 'PUT',
      body: { invoiceID: parseInt(invoiceId), reason: reason.trim() },
    });

    if (response.statusCode === 200) {
      showMessage('Invoice refunded', 'success');
      await fetchInvoice();
    } else {
      showMessage(response.message || 'Failed to refund the invoice', 'error');
    }
  } catch (error) {
    console.error('Error refunding invoice:', error);
    showMessage(error.data?.message || 'An error occurred while refunding the invoice', 'error');
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
  if (status === 'Paid') return 'success';
  if (status === 'Void') return 'secondary';
  return 'warning';
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
              <Icon name="ic:outline-arrow-back" class="mr-1" />
              Back to Invoices
            </rs-button>
          </NuxtLink>
        </div>
      </div>

      <!-- Loading State -->
      <section v-if="isLoading" class="flex justify-center items-center py-12">
        <div class="text-center">
          <Icon name="line-md:loading-twotone-loop" class="text-4xl mb-4" />
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
              <rs-badge v-if="invoiceData.pay_later" variant="secondary" class="text-sm mb-2 block">
                Zakat
              </rs-badge>
              <rs-badge v-if="hasPendingPayment" variant="info" class="text-sm mb-2 block">
                Pending Parent Payment
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
              <div v-if="invoiceData.latest_payment">
                <span class="text-sm text-gray-500">Latest Payment:</span>
                <div class="font-medium">{{ invoiceData.latest_payment.status }} ({{ invoiceData.latest_payment.method || "N/A" }})</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Items -->
        <div v-if="invoiceData.items && invoiceData.items.length" class="bg-white border border-gray-200 p-6 rounded-lg">
          <h6 class="font-semibold text-lg mb-4 text-gray-800">Items</h6>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Item</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Type</th>
                  <th class="px-3 py-2 text-right font-medium text-gray-500">Qty</th>
                  <th class="px-3 py-2 text-right font-medium text-gray-500">Unit price</th>
                  <th class="px-3 py-2 text-right font-medium text-gray-500">Subtotal</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="item in invoiceData.items" :key="item.item_id">
                  <td class="px-3 py-2">
                    {{ item.name }}
                    <div v-if="item.sessions" class="text-xs text-blue-700">{{ item.sessions }} session(s)</div>
                  </td>
                  <td class="px-3 py-2">{{ item.item_type }}</td>
                  <td class="px-3 py-2 text-right">{{ item.qty }}</td>
                  <td class="px-3 py-2 text-right">RM {{ formatPrice(item.unit_price) }}</td>
                  <td class="px-3 py-2 text-right font-medium">RM {{ formatPrice(item.subtotal) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="font-semibold">
                  <td colspan="4" class="px-3 py-2 text-right">Total</td>
                  <td class="px-3 py-2 text-right">RM {{ formatPrice(invoiceData.amount) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- Appointments this invoice bills -->
        <div v-if="invoiceData.billed_appointments && invoiceData.billed_appointments.length" class="bg-white border border-gray-200 p-6 rounded-lg">
          <h6 class="font-semibold text-lg mb-2 text-gray-800">Billed sessions</h6>
          <p class="text-sm text-gray-600 mb-3">Appointments booked without a prepaid session that this invoice asks the parent to pay for.</p>
          <ul class="text-sm space-y-1">
            <li v-for="appointment in invoiceData.billed_appointments" :key="appointment.appointment_id">
              {{ formatShortDate(appointment.date) }}
              <NuxtLink
                :to="{ path: '/appointmentManagement/newAppointment/scheduledAppointment', query: { editId: String(appointment.appointment_id) } }"
                class="ml-2 text-primary underline"
              >
                Open appointment
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Prepaid sessions taken from this invoice -->
        <div v-if="invoiceData.covered_appointments && invoiceData.covered_appointments.length" class="bg-white border border-gray-200 p-6 rounded-lg">
          <h6 class="font-semibold text-lg mb-2 text-gray-800">Sessions used</h6>
          <p class="text-sm text-gray-600 mb-3">Appointments that used a session from this paid package.</p>
          <ul class="text-sm space-y-1">
            <li v-for="appointment in invoiceData.covered_appointments" :key="appointment.appointment_id">
              {{ formatShortDate(appointment.date) }}
              <NuxtLink
                :to="{ path: '/appointmentManagement/newAppointment/scheduledAppointment', query: { editId: String(appointment.appointment_id) } }"
                class="ml-2 text-primary underline"
              >
                Open appointment
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Void notice -->
        <div v-if="isVoid" class="bg-gray-50 border border-gray-200 p-6 rounded-lg">
          <h6 class="font-semibold text-lg mb-2 text-gray-800">This invoice is void</h6>
          <p class="text-sm text-gray-600">
            It cannot be paid or changed.
            <span v-if="invoiceData.void_reason">Reason: {{ invoiceData.void_reason }}</span>
          </p>
        </div>

        <!-- Status Management -->
        <div v-else class="bg-white border border-gray-200 p-6 rounded-lg">
          <h6 class="font-semibold text-lg mb-4 text-gray-800">Status Management</h6>
          <div class="flex gap-4">
            <rs-button
              v-if="invoiceData.status === 'Unpaid'"
              variant="success"
              size="sm"
              :disabled="isUpdating || hasPendingPayment"
              @click="router.push({ path: '/payment/paymentForm', query: { invoiceId: String(invoiceData.invoice_id) } })"
            >
              <span>Record payment</span>
            </rs-button>
            <rs-button
              v-if="invoiceData.status === 'Paid' && !invoiceData.sessions_credited && invoiceData.latest_payment?.status !== 'Approved'"
              variant="warning"
              size="sm"
              :disabled="isUpdating || hasPendingPayment"
              @click="markUnpaid"
            >
              <Icon v-if="isUpdating" name="line-md:loading-twotone-loop" class="mr-2" />
              <span>{{ isUpdating ? 'Updating...' : 'Mark as Unpaid' }}</span>
            </rs-button>
            <rs-button
              v-if="invoiceData.status === 'Paid'"
              variant="danger"
              size="sm"
              :disabled="isUpdating"
              @click="refundInvoice"
            >
              Refund invoice
            </rs-button>
            <rs-button
              v-if="invoiceData.status === 'Unpaid'"
              variant="danger"
              size="sm"
              :disabled="isUpdating"
              @click="voidInvoice"
            >
              Void invoice
            </rs-button>
          </div>
          <p class="text-sm text-gray-600 mt-2">
            <strong>Note:</strong> An invoice is paid by recording a payment, which issues a receipt and adds any package sessions to the patient's account (once). The full amount is paid at once; part payments are not supported.
          </p>
          <p v-if="hasPendingPayment" class="text-sm text-blue-600 mt-2">
            Parent payment submission is pending approval. Approve/reject it from Pending Approvals before changing invoice status manually.
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
          <Icon name="ic:outline-error" class="text-4xl mb-4" />
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