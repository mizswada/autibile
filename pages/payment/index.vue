<script setup>
definePageMeta({
  title: "Payment",
});

// Sample invoice data (in a real app, this would come from an API)
const invoices = ref([
  {
    id: 'INV-001',
    date: '2023-06-15',
    dueDate: '2023-07-15',
    description: 'Therapy Session - Initial Assessment',
    amount: 350.00,
    status: 'Unpaid'
  },
  {
    id: 'INV-002',
    date: '2023-06-22',
    dueDate: '2023-07-22',
    description: 'Therapy Session - Follow-up',
    amount: 250.00,
    status: 'Unpaid'
  },
  {
    id: 'INV-003',
    date: '2023-05-10',
    dueDate: '2023-06-10',
    description: 'Workshop Registration',
    amount: 150.00,
    status: 'Paid'
  }
]);

const selectedInvoice = ref(null);
const showPaymentMethods = ref(false);
const selectedPaymentMethod = ref(null);
const router = useRouter();

const paymentMethods = [
  { 
    id: 'credit_card', 
    name: 'Credit/Debit Card', 
    icon: 'ic:outline-credit-card',
    description: 'Pay securely using your credit or debit card'
  },
  { 
    id: 'online_banking', 
    name: 'Online Banking', 
    icon: 'ic:outline-account-balance',
    description: 'Direct transfer from your bank account'
  },
  { 
    id: 'ewallet', 
    name: 'E-Wallet', 
    icon: 'ic:outline-account-balance-wallet',
    description: 'Pay using your preferred e-wallet'
  }
];

const formatPrice = (price) => {
  return parseFloat(price)
    .toFixed(2)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const selectInvoice = (invoice) => {
  selectedInvoice.value = invoice;
  showPaymentMethods.value = true;
};

const selectPaymentMethod = (method) => {
  selectedPaymentMethod.value = method;
};

const proceedToPayment = () => {
  // Navigate to the payment form with invoice and payment method information
  router.push({
    path: '/payment/paymentForm',
    query: {
      invoiceId: selectedInvoice.value.id,
      paymentMethod: selectedPaymentMethod.value.id
    }
  });
};

const printInvoice = () => {
  if (!selectedInvoice.value) {
    alert('Please select an invoice to print.');
    return;
  }

  const invoice = selectedInvoice.value;

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


</script>

<template>
  <div>
    <LayoutsBreadcrumb />

    <rs-card>
        <template #header>
        <div class="flex justify-between items-center">
            <h5 class="mb-0">Payment & Invoicing</h5>
            <div class="flex space-x-2">
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

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Left Column - Invoice List -->
        <div class="py-7 bg-[rgb(var(--bg-2))] rounded-lg">
          <div class="px-10">
            <h5>Invoices</h5>
            <p>Select an invoice to make a payment.</p>
          </div>
          <div class="mt-7 px-10">
            <rs-card 
              v-for="invoice in invoices" 
              :key="invoice.id" 
              class="mb-4 p-5 cursor-pointer hover:shadow-md transition-shadow"
              :class="{'border-2 border-primary': selectedInvoice && selectedInvoice.id === invoice.id}"
              @click="selectInvoice(invoice)"
            >
              <div class="flex justify-between items-start">
                <div>
                  <h6 class="mb-2">{{ invoice.id }}</h6>
                  <p class="mb-1">{{ invoice.description }}</p>
                  <div class="text-sm text-gray-500">
                    <span>Issue Date: {{ invoice.date }}</span>
                    <span class="mx-2">|</span>
                    <span>Due Date: {{ invoice.dueDate }}</span>
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-xl font-semibold">RM {{ formatPrice(invoice.amount) }}</div>
                  <rs-badge 
                    :variant="invoice.status === 'Paid' ? 'success' : 'warning'"
                    class="mt-2"
                  >
                    {{ invoice.status }}
                  </rs-badge>
                </div>
              </div>
            </rs-card>
          </div>
        </div>

        <!-- Right Column - Payment Methods -->
        <div class="py-7 bg-[rgb(var(--bg-2))] rounded-lg border-l border-l-[rgb(var(--border-color))]">
          <div class="px-10">
            <h5>Payment Methods</h5>
            <p v-if="!selectedInvoice">Please select an invoice first.</p>
            <p v-else>Choose your preferred payment method.</p>
          </div>
          
          <div v-if="showPaymentMethods" class="mt-7 px-10">
            <!-- Invoice Summary -->
            <div class="mb-6">
              <div class="text-base font-semibold bg-[rgb(var(--bg-1))] py-3 px-4 rounded-t-md">
                Invoice Summary
              </div>
              <div class="bg-[rgb(var(--bg-3))] p-4 rounded-b-md">
                <div class="flex justify-between mb-2">
                  <span>Invoice ID:</span>
                  <span class="font-semibold">{{ selectedInvoice.id }}</span>
                </div>
                <div class="flex justify-between mb-2">
                  <span>Description:</span>
                  <span class="font-semibold">{{ selectedInvoice.description }}</span>
                </div>
                <div class="flex justify-between mb-2">
                  <span>Due Date:</span>
                  <span class="font-semibold">{{ selectedInvoice.dueDate }}</span>
                </div>
                <div class="flex justify-between text-lg font-bold mt-3">
                  <span>Total Amount:</span>
                  <span>RM {{ formatPrice(selectedInvoice.amount) }}</span>
                </div>
              </div>
            </div>

            <!-- Payment Method Selection -->
            <div class="text-base font-semibold bg-[rgb(var(--bg-1))] py-3 px-4 my-4">
              Select Payment Method
            </div>
            
            <div class="space-y-4">
              <rs-card 
                v-for="method in paymentMethods" 
                :key="method.id"
                class="p-4 cursor-pointer hover:shadow-md transition-shadow"
                :class="{'border-2 border-primary': selectedPaymentMethod && selectedPaymentMethod.id === method.id}"
                @click="selectPaymentMethod(method)"
              >
                <div class="flex items-center">
                  <div class="mr-4 text-2xl">
                    <NuxtIcon :name="method.icon" />
                  </div>
                  <div>
                    <h6 class="mb-1">{{ method.name }}</h6>
                    <p class="text-sm text-gray-500">{{ method.description }}</p>
                  </div>
                </div>
              </rs-card>
            </div>

            <rs-button 
              class="w-full mt-6" 
              :disabled="!selectedPaymentMethod"
              @click="proceedToPayment"
            >
              Proceed to Payment
            </rs-button>
          </div>
          
          <div v-else class="mt-7 px-10 flex justify-center items-center h-64">
            <div class="text-center text-gray-500">
              <NuxtIcon name="ic:outline-payment" class="text-6xl mb-4" />
              <p>Select an invoice from the left to proceed with payment</p>
            </div>
          </div>
        </div>
      </div>
    </rs-card>
  </div>
</template> 