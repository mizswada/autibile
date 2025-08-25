<script setup>
import { ref, onMounted } from 'vue';
import logo from '@/assets/img/logo/splash.png';

definePageMeta({
  title: "Payment - Unpaid Invoices",
});

const router = useRouter();
const invoices = ref([]);
const loading = ref(true);
const error = ref('');
const selectedInvoice = ref(null);

// Fetch invoices from API
const fetchInvoices = async () => {
  loading.value = true;
  error.value = '';
  
  try {
    // Only fetch unpaid invoices
    const response = await $fetch('/api/payment/listInvoices?status=Unpaid');
    
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

const selectInvoice = (invoice) => {
  selectedInvoice.value = invoice;
};

const proceedToPayment = () => {
  if (!selectedInvoice.value) {
    alert('Please select an invoice to proceed with payment.');
    return;
  }
  
  // Navigate to the payment form with invoice information
  router.push({
    path: '/payment/paymentForm',
    query: {
      invoiceId: selectedInvoice.value.invoice_id
    }
  });
};

const printInvoice = () => {
  if (!selectedInvoice.value) {
    alert('Please select an invoice to print.');
    return;
  }

  const invoice = selectedInvoice.value;
  console.log('Logo URL:', logo);
  const absoluteLogo = window.location.origin + '/img/logo-splash.png';
  console.log('Absolute Logo:', absoluteLogo);

  const printContent = `
    <html>
    <head>
      <title>Invoice ${invoice.invoice_id}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        .header, .footer { text-align: center; }
        .logo { max-width: 150px; margin-bottom: 10px; }
        .company-info { text-align: left; }
        .invoice-meta { text-align: right; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; }
        th { background-color: #f2f2f2; }
        .summary { margin-top: 30px; float: right; width: 300px; }
        .summary div { display: flex; justify-content: space-between; padding: 4px 0; }
        .signature { margin-top: 60px; display: flex; justify-content: space-between; }
        .terms { margin-top: 80px; font-size: 12px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="${absoluteLogo}" class="logo" />
        <h2>Autibile</h2>
        <div class="company-info">
          47150 Puchong, Selangor.<br>
          1 - 4, Prima Bizwalk Business Park<br>
          Jalan Tasik Prima 6/2<br>
          Taman Tasik Prima,
        </div>
        <br>
      </div>

      <div class="invoice-meta">
        <p>Invoice No ${formatInvoiceId(invoice.invoice_id)}</p>
        <p>Sales Date ${formatDate(invoice.date)}</p>
        <p>Issued Date ${new Date().toLocaleDateString()}</p>
      </div>

      <div>
        <h4>BILL TO</h4>
        <p>${invoice.patient_name || 'N/A'}</p>
        <p>Patient ID: ${invoice.patient_id || 'N/A'}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Price</th>
            <th>Discount</th>
            <th>Qty</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${invoice.description}</td>
            <td>${formatPrice(invoice.amount)}</td>
            <td>0.00</td>
            <td>1</td>
            <td>${formatPrice(invoice.amount)}</td>
          </tr>
        </tbody>
      </table>

      <div class="summary">
        <div><span>Sub Total</span><span>${formatPrice(invoice.amount)}</span></div>
        <div><span>Grand Total</span><span>${formatPrice(invoice.amount)}</span></div>
        <div><span>Online</span><span>${formatPrice(invoice.amount)}</span></div>
      </div>

      <div class="signature">
        <div><strong>REMARK:</strong></div>
      </div>

      <div class="terms">
        <p><strong>Terms and Conditions</strong></p>
        <p>Thank you.<br>This is computer generated receipt no signature required.</p>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '', 'height=800,width=800');
  printWindow.document.write(printContent);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
};

const getStatusBadgeVariant = (status) => {
  return status === 'Paid' ? 'success' : 'warning';
};

onMounted(() => {
  fetchInvoices();
});
</script>

<template>
  <div>
    <LayoutsBreadcrumb />

    <rs-card>
        <template #header>
        <div class="flex justify-between items-center">
            <h5 class="mb-0">Payment</h5>
            <div class="flex space-x-2">
            <NuxtLink to="/payment/packages">
                <rs-button variant="primary">
                <NuxtIcon name="ic:outline-package" class="mr-1" />
                View Packages
                </rs-button>
            </NuxtLink>
            <NuxtLink to="/payment/products">
                <rs-button variant="primary">
                <NuxtIcon name="ic:outline-inventory" class="mr-1" />
                View Products
                </rs-button>
            </NuxtLink>
            <NuxtLink to="/payment/create">
                <rs-button variant="primary">
                <NuxtIcon name="ic:outline-add" class="mr-1" />
                Create Invoice
                </rs-button>
            </NuxtLink>
            <NuxtLink to="/payment/history">
                <rs-button variant="primary">
                <NuxtIcon name="ic:outline-history" class="mr-1" />
                Payment History
                </rs-button>
            </NuxtLink>
            <NuxtLink v-if="selectedInvoice" to="#">
            <rs-button variant="primary" @click="printInvoice">
                <NuxtIcon name="ic:outline-print" class="mr-1" />
                Print Invoice
            </rs-button>
            </NuxtLink>
            </div>
        </div>
        </template>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Left Column - Invoice List -->
        <div class="lg:col-span-2 py-7 bg-[rgb(var(--bg-2))] rounded-lg">
          <div class="px-10">
            <h5>Unpaid Invoices</h5>
            <p>Select an unpaid invoice to make a payment.</p>
          </div>
          
          <!-- Loading State -->
          <div v-if="loading" class="mt-7 px-10 flex justify-center items-center h-64">
            <div class="text-center">
              <NuxtIcon name="line-md:loading-twotone-loop" class="text-4xl mb-4" />
              <p>Loading unpaid invoices...</p>
            </div>
          </div>

          <!-- Error State -->
          <div v-else-if="error" class="mt-7 px-10 flex justify-center items-center h-64">
            <div class="text-center text-red-500">
              <NuxtIcon name="ic:outline-error" class="text-4xl mb-4" />
              <p>{{ error }}</p>
              <rs-button @click="fetchInvoices" class="mt-4">
                Try Again
              </rs-button>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else-if="invoices.length === 0" class="mt-7 px-10 flex justify-center items-center h-64">
            <div class="text-center text-gray-500">
              <NuxtIcon name="ic:outline-receipt" class="text-4xl mb-4" />
              <p>No unpaid invoices found</p>
              <p class="text-sm mt-2">All invoices have been paid or there are no invoices to display.</p>
              <NuxtLink to="/payment/history">
                <rs-button class="mt-4 mx-auto block">
                  View Payment History
                </rs-button>
              </NuxtLink>
            </div>
          </div>

          <!-- Invoice List -->
          <div v-else class="mt-7 px-10">
            <rs-card 
              v-for="invoice in invoices" 
              :key="invoice.invoice_id" 
              class="mb-4 p-5 cursor-pointer hover:shadow-md transition-shadow bg-gray-100"
              :class="{'border-2 border-primary': selectedInvoice && selectedInvoice.invoice_id === invoice.invoice_id}"
              @click="selectInvoice(invoice)"
            >
              <div class="flex justify-between items-start">
                <div>
                  <h6 class="mb-2">{{ formatInvoiceId(invoice.invoice_id) }}</h6>
                  <p class="mb-1">{{ invoice.description }}</p>
                  <div class="text-sm text-gray-500">
                    <span>Patient: {{ invoice.patient_name || 'N/A' }}</span>
                    <span class="mx-2">|</span>
                    <span>Date: {{ formatDate(invoice.date) }}</span>
                  </div>
                  <div class="text-sm text-gray-500 mt-1">
                    <span>Type: {{ invoice.invoice_type }}</span>
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-xl font-semibold">RM {{ formatPrice(invoice.amount) }}</div>
                  <rs-badge 
                    :variant="getStatusBadgeVariant(invoice.status)"
                    class="mt-2"
                  >
                    {{ invoice.status }}
                  </rs-badge>
                </div>
              </div>
            </rs-card>
          </div>
        </div>

        <!-- Right Column - Selected Invoice Summary -->
        <div class="py-7 bg-[rgb(var(--bg-2))] rounded-lg border-l border-l-[rgb(var(--border-color))]">
          <div class="px-10">
            <h5>Selected Invoice</h5>
            <p v-if="!selectedInvoice">Please select an invoice first.</p>
            <p v-else>Review invoice details before payment.</p>
          </div>
          
          <div v-if="selectedInvoice" class="mt-7 px-10">
            <!-- Invoice Summary -->
            <div class="mb-6">
              <div class="text-base font-semibold bg-[rgb(var(--bg-1))] py-3 px-4 rounded-t-md">
                Invoice Summary
              </div>
              <div class="bg-[rgb(var(--bg-3))] p-4 rounded-b-md">
                <div class="flex justify-between mb-2">
                  <span>Invoice ID:</span>
                  <span class="font-semibold">{{ formatInvoiceId(selectedInvoice.invoice_id) }}</span>
                </div>
                <div class="flex justify-between mb-2">
                  <span>Patient:</span>
                  <span class="font-semibold">{{ selectedInvoice.patient_name || 'N/A' }}</span>
                </div>
                <div class="flex justify-between mb-2">
                  <span>Description:</span>
                  <span class="font-semibold text-right block w-2/3 break-words">{{ selectedInvoice.description }}</span>
                </div>
                <div class="flex justify-between mb-2">
                  <span>Type:</span>
                  <span class="font-semibold">{{ selectedInvoice.invoice_type }}</span>
                </div>
                <div class="flex justify-between mb-2">
                  <span>Date:</span>
                  <span class="font-semibold">{{ formatDate(selectedInvoice.date) }}</span>
                </div>
                <div class="flex justify-between text-lg font-bold mt-3">
                  <span>Total Amount:</span>
                  <span>RM {{ formatPrice(selectedInvoice.amount) }}</span>
                </div>
              </div>
            </div>

            <!-- Payment Button -->
            <rs-button 
              class="w-full" 
              @click="proceedToPayment"
            >
              <NuxtIcon name="ic:outline-payment" class="mr-2" />
              Pay Now
            </rs-button>
          </div>
          
          <div v-else class="mt-7 px-10 flex justify-center items-center h-64">
            <div class="text-center text-gray-500">
              <NuxtIcon name="ic:outline-receipt" class="text-6xl mb-4" />
              <p>Select an invoice from the left to proceed with payment</p>
            </div>
          </div>
        </div>
      </div>
    </rs-card>
  </div>
</template> 