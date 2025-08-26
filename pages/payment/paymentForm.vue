<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';

definePageMeta({
  title: "Payment Form",
});

const router = useRouter();
const route = useRoute();
const isLoading = ref(true);
const isSubmitting = ref(false);
const message = ref('');
const messageType = ref('success');

// Get query parameters
const invoiceId = route.query.invoiceId;

// Invoice data
const invoiceData = ref(null);

// Payment form data
const form = ref({
  method: '',
  bank_name: '',
  reference_code: '',
});

// Payment method options (removed credit card)
const paymentMethods = [
  { value: 'Online Banking', label: 'Online Banking' },
  { value: 'E-Wallet', label: 'E-Wallet' },
];

// Bank options from lookup table
const bankOptions = ref([]);

function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => (message.value = ''), 3000);
}

// Fetch bank options from lookup table
const fetchBankOptions = async () => {
  try {
    const response = await $fetch('/api/lookup/banks');
    if (Array.isArray(response)) {
      bankOptions.value = response.map(bank => ({
        label: bank.title,
        value: bank.title
      }));
    }
  } catch (error) {
    console.error('Error fetching bank options:', error);
    // Fallback to common Malaysian banks if lookup fails
    bankOptions.value = [
      { label: 'Maybank', value: 'Maybank' },
      { label: 'CIMB Bank', value: 'CIMB Bank' },
      { label: 'Public Bank', value: 'Public Bank' },
      { label: 'RHB Bank', value: 'RHB Bank' },
      { label: 'Hong Leong Bank', value: 'Hong Leong Bank' },
      { label: 'AmBank', value: 'AmBank' },
      { label: 'UOB Bank', value: 'UOB Bank' },
      { label: 'Standard Chartered', value: 'Standard Chartered' },
      { label: 'HSBC Bank', value: 'HSBC Bank' },
      { label: 'OCBC Bank', value: 'OCBC Bank' },
    ];
  }
};

// Fetch invoice details
const fetchInvoice = async () => {
  if (!invoiceId) {
    showMessage('No invoice ID provided', 'error');
    router.push('/payment');
    return;
  }

  isLoading.value = true;
  try {
    const response = await $fetch(`/api/payment/getInvoice/${invoiceId}`);
    if (response.statusCode === 200) {
      invoiceData.value = response.data;
    } else {
      showMessage('Failed to load invoice data', 'error');
      router.push('/payment');
    }
  } catch (error) {
    console.error('Error fetching invoice:', error);
    showMessage('An error occurred while loading the invoice', 'error');
    router.push('/payment');
  } finally {
    isLoading.value = false;
  }
};

// Submit payment
const submitPayment = async () => {
  // Validate form
  if (!form.value.method || !form.value.bank_name || !form.value.reference_code) {
    showMessage('Please fill in all required fields', 'error');
    return;
  }

  isSubmitting.value = true;
  try {
    const response = await $fetch('/api/payment/createPayment', {
      method: 'POST',
      body: {
        invoiceID: parseInt(invoiceId),
        patientID: invoiceData.value.patient_id,
        amount: invoiceData.value.amount,
        method: form.value.method,
        bank_name: form.value.bank_name,
        reference_code: form.value.reference_code,
      },
    });

    if (response.statusCode === 201) {
      showMessage('Payment submitted successfully', 'success');
      
      // Redirect to payment success page or back to payment list
      setTimeout(() => {
        router.push('/payment');
      }, 2000);
    } else {
      showMessage(response.message || 'Failed to submit payment', 'error');
    }
  } catch (error) {
    console.error('Error submitting payment:', error);
    showMessage(error.data?.message || 'An error occurred while submitting payment', 'error');
  } finally {
    isSubmitting.value = false;
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

onMounted(() => {
  fetchInvoice();
  fetchBankOptions();
});
</script>

<template>
  <main>
    <LayoutsBreadcrumb />

    <rs-card class="p-6">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
        <h5 class="text-xl font-semibold mb-4 md:mb-0">Payment Form</h5>
                 <div class="flex flex-wrap gap-2">
           <NuxtLink to="/payment">
             <rs-button variant="ghost" size="sm">
               <NuxtIcon name="ic:outline-arrow-back" class="mr-1" />
               Back to Invoices
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

      <!-- Payment Form -->
      <section v-else-if="invoiceData" class="space-y-6">
        <!-- Invoice Summary -->
        <div class="bg-gray-50 p-6 rounded-lg">
          <h6 class="font-semibold text-lg mb-4 text-gray-800">Invoice Summary</h6>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
               <span class="text-sm text-gray-500">Invoice ID:</span>
               <div class="font-medium">{{ formatInvoiceId(invoiceData.invoice_id) }}</div>
             </div>
            <div>
              <span class="text-sm text-gray-500">Patient:</span>
              <div class="font-medium">{{ invoiceData.patient_name || 'N/A' }}</div>
            </div>
            <div>
              <span class="text-sm text-gray-500">Description:</span>
              <div class="font-medium">{{ invoiceData.description }}</div>
            </div>
            <div>
              <span class="text-sm text-gray-500">Date:</span>
              <div class="font-medium">{{ formatDate(invoiceData.date) }}</div>
            </div>
            <div class="md:col-span-2">
              <span class="text-sm text-gray-500">Amount:</span>
              <div class="text-2xl font-bold text-green-600">RM {{ formatPrice(invoiceData.amount) }}</div>
            </div>
          </div>
        </div>

        <!-- Payment Form -->
        <div class="bg-white border border-gray-200 p-6 rounded-lg">
          <h6 class="font-semibold text-lg mb-4 text-gray-800">Payment Details</h6>
          
                     <FormKit type="form" :actions="false">
            <!-- Payment Method -->
            <FormKit 
              type="select" 
              v-model="form.method" 
              label="Payment Method" 
              placeholder="Select payment method"
              :options="[
                { label: '-- Please select --', value: '' },
                ...paymentMethods
              ]"
              validation="required|not:"
            />

            <!-- Bank Name / Payment Provider -->
            <FormKit 
              v-if="form.method === 'Online Banking'"
              type="select" 
              v-model="form.bank_name" 
              label="Bank Name" 
              placeholder="Select your bank"
              :options="[
                { label: '-- Please select --', value: '' },
                ...bankOptions
              ]"
              validation="required"
            />

            <FormKit 
              v-else-if="form.method === 'E-Wallet'"
              type="text" 
              v-model="form.bank_name" 
              label="E-Wallet Provider" 
              placeholder="e.g. Touch n Go, Boost, GrabPay, ShopeePay"
              validation="required"
            />

            <!-- Reference Code -->
            <FormKit 
              type="text" 
              v-model="form.reference_code" 
              label="Reference Code / Transaction ID" 
              placeholder="e.g. TXN123456789, REF987654321"
              validation="required"
            />

                         <!-- Submit Button -->
             <div class="flex gap-4 mt-6">
               <rs-button 
                 type="button"
                 class="w-full" 
                 :disabled="isSubmitting"
                 @click="submitPayment"
               >
                 <div class="flex items-center justify-center">
                   <NuxtIcon v-if="isSubmitting" name="line-md:loading-twotone-loop" class="mr-2" />
                   <span>{{ isSubmitting ? 'Processing Payment...' : 'Submit Payment' }}</span>
                 </div>
               </rs-button>

              <rs-button 
                variant="ghost" 
                class="w-full bg-gray-200" 
                @click="router.push('/payment')" 
                :disabled="isSubmitting"
              >
                Cancel
              </rs-button>
            </div>
          </FormKit>
        </div>

        <!-- Payment Instructions -->
        <div class="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <h6 class="font-medium text-blue-800 mb-2">Payment Instructions</h6>
          <div class="text-sm text-blue-700 space-y-2">
            <p><strong>For Online Banking:</strong> Select your bank from the dropdown and enter the transaction reference number provided by your bank.</p>
            <p><strong>For E-Wallet:</strong> Enter the e-wallet provider name (e.g., Touch n Go, Boost, GrabPay, ShopeePay) and the transaction reference.</p>
            <p class="mt-3"><strong>Note:</strong> Please keep your payment receipt for verification purposes.</p>
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