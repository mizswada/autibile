<script setup>
definePageMeta({
  title: "Payment History",
});

// Sample payment history data (in a real app, this would come from an API)
const paymentHistory = ref([
  {
    id: 'PAY-001',
    invoiceId: 'INV-003',
    date: '2023-05-15',
    amount: 150.00,
    method: 'Credit Card',
    status: 'Completed',
    reference: 'REF123456789'
  },
  {
    id: 'PAY-002',
    invoiceId: 'INV-004',
    date: '2023-04-20',
    amount: 200.00,
    method: 'Online Banking',
    status: 'Completed',
    reference: 'REF987654321'
  },
  {
    id: 'PAY-003',
    invoiceId: 'INV-005',
    date: '2023-03-10',
    amount: 350.00,
    method: 'E-Wallet',
    status: 'Completed',
    reference: 'REF456789123'
  }
]);

// Sample invoice history data
const invoiceHistory = ref([
  {
    id: 'INV-003',
    date: '2023-05-10',
    dueDate: '2023-06-10',
    description: 'Workshop Registration',
    amount: 150.00,
    status: 'Paid',
    paymentDate: '2023-05-15'
  },
  {
    id: 'INV-004',
    date: '2023-04-15',
    dueDate: '2023-05-15',
    description: 'Monthly Therapy Session',
    amount: 200.00,
    status: 'Paid',
    paymentDate: '2023-04-20'
  },
  {
    id: 'INV-005',
    date: '2023-03-05',
    dueDate: '2023-04-05',
    description: 'Comprehensive Assessment',
    amount: 350.00,
    status: 'Paid',
    paymentDate: '2023-03-10'
  },
  {
    id: 'INV-006',
    date: '2023-02-10',
    dueDate: '2023-03-10',
    description: 'Parent Training Workshop',
    amount: 120.00,
    status: 'Paid',
    paymentDate: '2023-02-15'
  },
  {
    id: 'INV-007',
    date: '2023-01-05',
    dueDate: '2023-02-05',
    description: 'Follow-up Session',
    amount: 180.00,
    status: 'Paid',
    paymentDate: '2023-01-12'
  }
]);

const activeTab = ref('invoices');
const selectedInvoice = ref(null);
const showInvoiceDetails = ref(false);
const selectedPayment = ref(null);
const showPaymentDetails = ref(false);

const formatPrice = (price) => {
  return parseFloat(price)
    .toFixed(2)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const viewInvoiceDetails = (invoice) => {
  selectedInvoice.value = invoice;
  showInvoiceDetails.value = true;
};

const viewPaymentDetails = (payment) => {
  selectedPayment.value = payment;
  showPaymentDetails.value = true;
};

const closeDetails = () => {
  showInvoiceDetails.value = false;
  showPaymentDetails.value = false;
};

const downloadInvoice = (invoiceId) => {
  // In a real app, this would generate and download a PDF invoice
  alert(`Downloading invoice ${invoiceId}...`);
};

const printInvoice = (invoiceId) => {
  const invoice = invoiceHistory.value.find(inv => inv.id === invoiceId);
  if (!invoice) {
    alert('Invoice not found.');
    return;
  }

  const printContent = `
    <html>
    <head>
      <title>Invoice ${invoice.id}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        .header, .footer { text-align: center; }
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
        <p>Invoice No ${invoice.id}</p>
        <p>Sales Date ${invoice.date}</p>
        <p>Issued Date ${new Date().toLocaleDateString()}</p>
      </div>

      <div>
        <h4>BILL TO</h4>
        <p>${invoice.description}</p>
        <p>60195664313</p>
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
        <div><strong>Signature:</strong></div>
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



// Filter and search functionality
const searchQuery = ref('');
const statusFilter = ref('all');

const filteredInvoices = computed(() => {
  let result = [...invoiceHistory.value];
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(invoice => 
      invoice.id.toLowerCase().includes(query) || 
      invoice.description.toLowerCase().includes(query)
    );
  }
  
  if (statusFilter.value !== 'all') {
    result = result.filter(invoice => invoice.status.toLowerCase() === statusFilter.value);
  }
  
  return result;
});

const filteredPayments = computed(() => {
  let result = [...paymentHistory.value];
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(payment => 
      payment.id.toLowerCase().includes(query) || 
      payment.invoiceId.toLowerCase().includes(query) ||
      payment.reference.toLowerCase().includes(query)
    );
  }
  
  return result;
});
</script>

<template>
  <div>
    <LayoutsBreadcrumb />

    <rs-card>
      <template #header>
        <div class="flex justify-between items-center">
          <h5 class="mb-0">Payment History</h5>
          <NuxtLink to="/payment">
            <rs-button variant="outline">
              <NuxtIcon name="ic:outline-payment" class="mr-1" />
              Make a Payment
            </rs-button>
          </NuxtLink>
        </div>
      </template>
      
      <!-- Tabs -->
      <div class="border-b border-[rgb(var(--border-color))]">
        <div class="flex">
          <button 
            class="py-3 px-6 border-b-2 font-medium text-sm"
            :class="activeTab === 'invoices' ? 'border-primary text-primary' : 'border-transparent hover:border-gray-300'"
            @click="activeTab = 'invoices'"
          >
            Invoices
          </button>
          <button 
            class="py-3 px-6 border-b-2 font-medium text-sm"
            :class="activeTab === 'payments' ? 'border-primary text-primary' : 'border-transparent hover:border-gray-300'"
            @click="activeTab = 'payments'"
          >
            Payments
          </button>
        </div>
      </div>
      
      <!-- Search and Filter -->
      <div class="p-4 bg-[rgb(var(--bg-2))]">
        <div class="flex flex-col md:flex-row gap-4">
          <div class="flex-1">
            <FormKit
              type="text"
              placeholder="Search by ID or description"
              v-model="searchQuery"
              outer-class="mb-0"
              prefix-icon="search"
            />
          </div>
          <div v-if="activeTab === 'invoices'" class="w-full md:w-48">
            <FormKit
              type="select"
              placeholder="Filter by status"
              v-model="statusFilter"
              :options="[
                { label: 'All', value: 'all' },
                { label: 'Paid', value: 'paid' },
                { label: 'Unpaid', value: 'unpaid' }
              ]"
              outer-class="mb-0"
            />
          </div>
        </div>
      </div>
      
      <!-- Invoices Tab -->
      <div v-if="activeTab === 'invoices'" class="p-4">
        <div v-if="filteredInvoices.length === 0" class="text-center py-8">
          <NuxtIcon name="ic:outline-receipt" class="text-6xl mb-4 text-gray-400" />
          <p class="text-gray-500">No invoices found matching your criteria</p>
        </div>
        
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-[rgb(var(--border-color))]">
            <thead>
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Invoice ID</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Description</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Issue Date</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Due Date</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Amount</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[rgb(var(--border-color))]">
              <tr v-for="invoice in filteredInvoices" :key="invoice.id" class="hover:bg-[rgb(var(--bg-2))]">
                <td class="px-6 py-4 whitespace-nowrap">{{ invoice.id }}</td>
                <td class="px-6 py-4">{{ invoice.description }}</td>
                <td class="px-6 py-4 whitespace-nowrap">{{ invoice.date }}</td>
                <td class="px-6 py-4 whitespace-nowrap">{{ invoice.dueDate }}</td>
                <td class="px-6 py-4 whitespace-nowrap">RM {{ formatPrice(invoice.amount) }}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <rs-badge :variant="invoice.status === 'Paid' ? 'success' : 'warning'">
                    {{ invoice.status }}
                  </rs-badge>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex space-x-2">
                    <rs-button variant="text" @click="viewInvoiceDetails(invoice)">
                    <Icon name="mdi:eye" />
                    </rs-button>
                    <rs-button variant="text" @click="downloadInvoice(invoice.id)">
                    <Icon name="mdi:download" />
                    </rs-button>
                    <rs-button variant="text" @click="printInvoice(invoice.id)">
                    <Icon name="mdi:printer" />
                    </rs-button>
                </div>
                </td>

              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- Payments Tab -->
      <div v-if="activeTab === 'payments'" class="p-4">
        <div v-if="filteredPayments.length === 0" class="text-center py-8">
          <NuxtIcon name="ic:outline-credit-card" class="text-6xl mb-4 text-gray-400" />
          <p class="text-gray-500">No payments found matching your criteria</p>
        </div>
        
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-[rgb(var(--border-color))]">
            <thead>
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Payment ID</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Invoice ID</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Amount</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Method</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[rgb(var(--border-color))]">
              <tr v-for="payment in filteredPayments" :key="payment.id" class="hover:bg-[rgb(var(--bg-2))]">
                <td class="px-6 py-4 whitespace-nowrap">{{ payment.id }}</td>
                <td class="px-6 py-4 whitespace-nowrap">{{ payment.invoiceId }}</td>
                <td class="px-6 py-4 whitespace-nowrap">{{ payment.date }}</td>
                <td class="px-6 py-4 whitespace-nowrap">RM {{ formatPrice(payment.amount) }}</td>
                <td class="px-6 py-4 whitespace-nowrap">{{ payment.method }}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <rs-badge variant="success">
                    {{ payment.status }}
                  </rs-badge>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <rs-button variant="text" size="sm" @click="viewPaymentDetails(payment)">
                    <Icon name="ic:outline-visibility" />
                  </rs-button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </rs-card>
    
    <!-- Invoice Details Modal -->
    <rs-modal v-model="showInvoiceDetails" title="Invoice Details">
      <div v-if="selectedInvoice" class="p-4">
        <div class="flex justify-between items-center mb-6">
          <h5>Invoice {{ selectedInvoice.id }}</h5>
          <rs-badge :variant="selectedInvoice.status === 'Paid' ? 'success' : 'warning'">
            {{ selectedInvoice.status }}
          </rs-badge>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <p class="text-sm text-gray-500">Issue Date</p>
            <p class="font-medium">{{ selectedInvoice.date }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Due Date</p>
            <p class="font-medium">{{ selectedInvoice.dueDate }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Description</p>
            <p class="font-medium">{{ selectedInvoice.description }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Amount</p>
            <p class="font-medium">RM {{ formatPrice(selectedInvoice.amount) }}</p>
          </div>
          <div v-if="selectedInvoice.status === 'Paid'">
            <p class="text-sm text-gray-500">Payment Date</p>
            <p class="font-medium">{{ selectedInvoice.paymentDate }}</p>
          </div>
        </div>
        
        <!-- <div class="flex justify-end space-x-2">
          <rs-button variant="outline" @click="downloadInvoice(selectedInvoice.id)">
            <NuxtIcon name="ic:outline-download" class="mr-1" />
            Download
          </rs-button>
          <rs-button variant="outline" @click="printInvoice(selectedInvoice.id)">
            <NuxtIcon name="ic:outline-print" class="mr-1" />
            Print
          </rs-button>
          <rs-button @click="closeDetails">Close</rs-button>
        </div> -->
      </div>
    </rs-modal>
    
    <!-- Payment Details Modal -->
    <rs-modal v-model="showPaymentDetails" title="Payment Details">
      <div v-if="selectedPayment" class="p-4">
        <div class="flex justify-between items-center mb-6">
          <h5>Payment {{ selectedPayment.id }}</h5>
          <rs-badge variant="success">
            {{ selectedPayment.status }}
          </rs-badge>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <p class="text-sm text-gray-500">Invoice ID</p>
            <p class="font-medium">{{ selectedPayment.invoiceId }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Payment Date</p>
            <p class="font-medium">{{ selectedPayment.date }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Amount</p>
            <p class="font-medium">RM {{ formatPrice(selectedPayment.amount) }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Payment Method</p>
            <p class="font-medium">{{ selectedPayment.method }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Reference Number</p>
            <p class="font-medium">{{ selectedPayment.reference }}</p>
          </div>
        </div>
        
        <!-- <div class="flex justify-end">
          <rs-button @click="closeDetails">Close</rs-button>
        </div> -->
      </div>
    </rs-modal>
  </div>
</template> 