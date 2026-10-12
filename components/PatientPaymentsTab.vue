<script setup>
import { ref, computed, onMounted } from 'vue';
import { useToast } from 'vue-toastification';
import {
  buildInvoiceDocOptions,
  buildReceiptDocOptions,
  formatInvoiceId,
  formatPaymentId,
  renderDocumentPdf,
} from '~/utils/paymentDocuments';

const props = defineProps({
  patientId: { type: [String, Number], required: true },
  patientName: { type: String, default: '' },
});

const toast = useToast();

const isLoading = ref(true);
const loadError = ref('');
const summary = ref(null);
const invoices = ref([]);

const currentPage = ref(1);
const itemsPerPage = ref(10);
const busyKey = ref('');

const totalPages = computed(() => Math.max(1, Math.ceil(invoices.value.length / itemsPerPage.value)));
const paginatedInvoices = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  return invoices.value.slice(start, start + itemsPerPage.value);
});

const formatPrice = (price) =>
  Number(price || 0)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

const statusBadge = (status) => {
  if (status === 'Paid') return 'success';
  if (status === 'Pending Approval') return 'info';
  if (status === 'Zakat: awaiting payment') return 'secondary';
  return 'warning';
};

async function loadPayments() {
  isLoading.value = true;
  loadError.value = '';
  try {
    const response = await $fetch(`/api/patientProfile/payments?patientId=${props.patientId}`);
    if (response.statusCode === 200) {
      summary.value = response.data.summary;
      invoices.value = response.data.invoices;
      currentPage.value = 1;
    } else {
      loadError.value = response.message || 'Failed to load payments';
    }
  } catch (error) {
    console.error('Error loading patient payments:', error);
    loadError.value = 'An error occurred while loading payments';
  } finally {
    isLoading.value = false;
  }
}

async function downloadInvoicePdf(invoice) {
  busyKey.value = `inv-${invoice.invoice_id}`;
  try {
    const { default: jsPDF } = await import('jspdf');
    const pdf = await renderDocumentPdf(
      jsPDF,
      buildInvoiceDocOptions({
        invoice_id: invoice.invoice_id,
        date: invoice.date,
        status: invoice.status,
        patient_name: props.patientName,
        patient_id: invoice.patient_id,
        invoice_type: invoice.invoice_type,
        description: invoice.description,
        amount: invoice.amount,
        items: invoice.items,
      }),
    );
    pdf.save(`Invoice_${formatInvoiceId(invoice.invoice_id)}_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    toast.error('Could not generate the invoice PDF');
  } finally {
    busyKey.value = '';
  }
}

async function downloadReceiptPdf(invoice) {
  busyKey.value = `rec-${invoice.invoice_id}`;
  try {
    const response = await $fetch(`/api/payment/getPayment/${invoice.payment_id}`);
    if (response.statusCode !== 200) {
      toast.error(response.message || 'Receipt not found');
      return;
    }
    const { default: jsPDF } = await import('jspdf');
    const payment = response.data;
    const pdf = await renderDocumentPdf(jsPDF, buildReceiptDocOptions(payment));
    pdf.save(`Receipt_${formatPaymentId(payment.payment_id)}_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (error) {
    console.error('Error generating receipt PDF:', error);
    toast.error('Could not generate the receipt PDF');
  } finally {
    busyKey.value = '';
  }
}

onMounted(loadPayments);
</script>

<template>
  <div class="space-y-6">
    <div v-if="isLoading" class="flex justify-center items-center py-12">
      <Icon name="line-md:loading-twotone-loop" size="40" />
    </div>

    <div v-else-if="loadError" class="text-center text-red-500 py-8">
      <p>{{ loadError }}</p>
      <rs-button class="mt-4" @click="loadPayments">Try Again</rs-button>
    </div>

    <template v-else>
      <!-- Summary -->
      <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-xl font-semibold mb-4 bg-purple-50 text-purple-800 border-b border-purple-200 p-2 rounded-lg">
          Sales Summary
        </h2>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="p-4 rounded-lg bg-green-50">
            <p class="text-sm text-gray-500">Total sales (paid)</p>
            <p class="text-2xl font-bold text-green-700">RM {{ formatPrice(summary.totalSales) }}</p>
          </div>
          <div class="p-4 rounded-lg bg-amber-50">
            <p class="text-sm text-gray-500">Outstanding (unpaid)</p>
            <p class="text-2xl font-bold text-amber-700">RM {{ formatPrice(summary.outstanding) }}</p>
          </div>
          <div class="p-4 rounded-lg bg-gray-50">
            <p class="text-sm text-gray-500">Invoices</p>
            <p class="text-2xl font-bold">{{ summary.paidCount }} / {{ summary.invoiceCount }} paid</p>
          </div>
          <div class="p-4 rounded-lg bg-gray-50">
            <p class="text-sm text-gray-500">Last payment</p>
            <p class="text-2xl font-bold">{{ formatDate(summary.lastPaymentDate) }}</p>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-sm">
          <div class="flex justify-between p-3 rounded-lg border border-blue-200 bg-blue-50">
            <span>Therapy</span><span class="font-semibold">RM {{ formatPrice(summary.therapySales) }}</span>
          </div>
          <div class="flex justify-between p-3 rounded-lg border border-green-200 bg-green-50">
            <span>Products</span><span class="font-semibold">RM {{ formatPrice(summary.productSales) }}</span>
          </div>
          <div class="flex justify-between p-3 rounded-lg border border-gray-200 bg-gray-50">
            <span>Other</span><span class="font-semibold">RM {{ formatPrice(summary.otherSales) }}</span>
          </div>
        </div>
      </div>

      <!-- History -->
      <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-xl font-semibold mb-4 bg-purple-50 text-purple-800 border-b border-purple-200 p-2 rounded-lg">
          Sales History
        </h2>

        <div v-if="invoices.length === 0" class="text-gray-400 text-center py-8">
          <Icon name="material-symbols:receipt-long-outline" size="48" />
          <p class="mt-2">No invoices for this patient yet</p>
        </div>

        <div v-else class="border rounded-lg overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="invoice in paginatedInvoices" :key="invoice.invoice_id">
                  <td class="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{{ formatInvoiceId(invoice.invoice_id) }}</td>
                  <td class="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{{ formatDate(invoice.date) }}</td>
                  <td class="px-6 py-4 text-sm text-gray-900">
                    <template v-if="invoice.items.length">
                      <div v-for="item in invoice.items" :key="item.item_id">
                        {{ item.name }}<span v-if="item.qty > 1"> x{{ item.qty }}</span>
                      </div>
                    </template>
                    <template v-else>{{ invoice.invoice_type || invoice.description }}</template>
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">RM {{ formatPrice(invoice.amount) }}</td>
                  <td class="px-6 py-4 text-sm whitespace-nowrap">
                    <rs-badge :variant="statusBadge(invoice.display_status)">{{ invoice.display_status }}</rs-badge>
                    <div v-if="invoice.status === 'Paid' && invoice.payment_date" class="text-xs text-gray-500 mt-1">
                      {{ formatDate(invoice.payment_date) }}<span v-if="invoice.payment_method"> · {{ invoice.payment_method }}</span>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-sm whitespace-nowrap">
                    <div class="table-action-group">
                      <button
                        type="button"
                        class="table-action-icon table-action-icon--primary"
                        title="Download invoice"
                        :disabled="busyKey === `inv-${invoice.invoice_id}`"
                        @click="downloadInvoicePdf(invoice)"
                      >
                        <Icon
                          :name="busyKey === `inv-${invoice.invoice_id}` ? 'line-md:loading-twotone-loop' : 'material-symbols:download-outline'"
                          size="22"
                        />
                      </button>
                      <button
                        v-if="invoice.payment_id"
                        type="button"
                        class="table-action-icon table-action-icon--primary"
                        title="Download receipt"
                        :disabled="busyKey === `rec-${invoice.invoice_id}`"
                        @click="downloadReceiptPdf(invoice)"
                      >
                        <Icon
                          :name="busyKey === `rec-${invoice.invoice_id}` ? 'line-md:loading-twotone-loop' : 'material-symbols:receipt-long-outline'"
                          size="22"
                        />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="totalPages > 1" class="flex items-center justify-between px-6 py-3 bg-gray-50 border-t">
            <span class="text-sm text-gray-600">Page {{ currentPage }} of {{ totalPages }}</span>
            <div class="flex gap-2">
              <rs-button size="sm" variant="ghost" :disabled="currentPage <= 1" @click="currentPage--">Previous</rs-button>
              <rs-button size="sm" variant="ghost" :disabled="currentPage >= totalPages" @click="currentPage++">Next</rs-button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
