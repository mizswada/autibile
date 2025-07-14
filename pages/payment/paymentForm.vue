<script setup>
definePageMeta({
  title: "Payment Form",
});

const route = useRoute();
const router = useRouter();

// Get invoice and payment method from route params
const invoiceId = route.query.invoiceId;
const paymentMethodId = route.query.paymentMethod;

// Form data
const formData = reactive({
  // Credit Card
  cardNumber: '',
  cardName: '',
  expiryDate: '',
  cvv: '',
  
  // Online Banking
  bank: '',
  accountName: '',
  
  // E-Wallet
  walletType: '',
  walletId: '',
  
  // Common fields
  email: '',
  phone: '',
  savePaymentMethod: false
});

// Options for form selects
const bankOptions = [
  { label: 'Maybank', value: 'maybank' },
  { label: 'CIMB Bank', value: 'cimb' },
  { label: 'Public Bank', value: 'public_bank' },
  { label: 'RHB Bank', value: 'rhb' },
  { label: 'Hong Leong Bank', value: 'hong_leong' }
];

const walletOptions = [
  { label: 'Touch n Go', value: 'tng' },
  { label: 'GrabPay', value: 'grabpay' },
  { label: 'Boost', value: 'boost' },
  { label: 'ShopeePay', value: 'shopeepay' }
];

// Mock invoice data (in a real app, this would be fetched from API)
const invoice = ref({
  id: invoiceId || 'INV-001',
  date: '2023-06-15',
  dueDate: '2023-07-15',
  description: 'Therapy Session - Initial Assessment',
  amount: 350.00,
  status: 'Unpaid'
});

// Mock payment method (in a real app, this would be fetched from API)
const paymentMethod = ref({
  id: paymentMethodId || 'credit_card',
  name: paymentMethodId === 'credit_card' ? 'Credit/Debit Card' : 
        paymentMethodId === 'online_banking' ? 'Online Banking' : 
        paymentMethodId === 'ewallet' ? 'E-Wallet' : 'Credit/Debit Card'
});

const isSubmitting = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

const formatPrice = (price) => {
  return parseFloat(price)
    .toFixed(2)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const submitPayment = () => {
  isSubmitting.value = true;
  errorMessage.value = '';
  
  // Simulate API call with timeout
  setTimeout(() => {
    isSubmitting.value = false;
    
    // In a real app, validate form and process payment here
    if (Math.random() > 0.2) { // 80% success rate for demo
      successMessage.value = 'Payment processed successfully!';
      
      // Redirect after success message
      setTimeout(() => {
        router.push('/payment');
      }, 2000);
    } else {
      errorMessage.value = 'Payment processing failed. Please try again.';
    }
  }, 1500);
};

const goBack = () => {
  router.push('/payment');
};
</script>

<template>
  <div>
    <LayoutsBreadcrumb />

    <rs-card>
      <template #header>
        <div class="flex justify-between items-center">
          <h5 class="mb-0">Complete Your Payment</h5>
          <rs-button variant="text" @click="goBack">
            <NuxtIcon name="ic:outline-arrow-back" class="mr-1" />
            Back to Invoices
          </rs-button>
        </div>
      </template>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Left Column - Payment Form -->
        <div class="md:col-span-2 py-7">
          <div class="px-6">
            <h5>{{ paymentMethod.name }}</h5>
            <p class="text-gray-500 mb-6">Please enter your payment details below</p>
            
            <div v-if="errorMessage" class="mb-6">
              <rs-alert variant="danger" dismissible @dismiss="errorMessage = ''">
                {{ errorMessage }}
              </rs-alert>
            </div>
            
            <div v-if="successMessage" class="mb-6">
              <rs-alert variant="success" dismissible @dismiss="successMessage = ''">
                {{ successMessage }}
              </rs-alert>
            </div>
            
            <!-- Credit Card Form -->
            <div v-if="paymentMethod.id === 'credit_card'">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <FormKit
                  type="mask"
                  label="Card Number"
                  placeholder="**** **** **** ****"
                  mask="#### #### #### ####"
                  v-model="formData.cardNumber"
                  validation="required"
                  :classes="{
                    outer: 'md:col-span-2'
                  }"
                />
                <FormKit
                  type="text"
                  label="Cardholder Name"
                  placeholder="Enter cardholder name"
                  v-model="formData.cardName"
                  validation="required"
                  :classes="{
                    outer: 'md:col-span-2'
                  }"
                />
                <FormKit
                  type="mask"
                  label="Expiry Date"
                  placeholder="MM/YY"
                  mask="##/##"
                  v-model="formData.expiryDate"
                  validation="required"
                />
                <FormKit
                  type="mask"
                  label="CVV"
                  placeholder="***"
                  mask="###"
                  v-model="formData.cvv"
                  validation="required"
                />
              </div>
            </div>
            
            <!-- Online Banking Form -->
            <div v-if="paymentMethod.id === 'online_banking'">
              <div class="grid grid-cols-1 gap-4 mb-6">
                <FormKit
                  type="select"
                  label="Select Bank"
                  placeholder="Choose your bank"
                  :options="bankOptions"
                  v-model="formData.bank"
                  validation="required"
                />
                <FormKit
                  type="text"
                  label="Account Name"
                  placeholder="Enter account name"
                  v-model="formData.accountName"
                  validation="required"
                />
              </div>
            </div>
            
            <!-- E-Wallet Form -->
            <div v-if="paymentMethod.id === 'ewallet'">
              <div class="grid grid-cols-1 gap-4 mb-6">
                <FormKit
                  type="select"
                  label="E-Wallet Provider"
                  placeholder="Choose your e-wallet"
                  :options="walletOptions"
                  v-model="formData.walletType"
                  validation="required"
                />
                <FormKit
                  type="text"
                  label="E-Wallet ID / Phone Number"
                  placeholder="Enter your e-wallet ID or phone number"
                  v-model="formData.walletId"
                  validation="required"
                />
              </div>
            </div>
            
            <!-- Common Fields -->
            <div class="text-base font-semibold bg-[rgb(var(--bg-1))] py-3 px-4 my-4 rounded">
              Contact Information
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <FormKit
                type="email"
                label="Email"
                placeholder="Enter your email"
                v-model="formData.email"
                validation="required|email"
              />
              <FormKit
                type="mask"
                label="Phone Number"
                placeholder="Enter your phone number"
                mask="###########"
                v-model="formData.phone"
                validation="required"
              />
            </div>
            
            <FormKit
              type="checkbox"
              label="Save payment method for future transactions"
              v-model="formData.savePaymentMethod"
            />
            
            <rs-button 
              class="w-full mt-6" 
              @click="submitPayment"
              :loading="isSubmitting"
              :disabled="isSubmitting"
            >
              Pay RM {{ formatPrice(invoice.amount) }}
            </rs-button>
          </div>
        </div>
        
        <!-- Right Column - Invoice Summary -->
        <div class="py-7 bg-[rgb(var(--bg-2))] rounded-lg">
          <div class="px-6">
            <h5>Invoice Summary</h5>
            <p class="text-gray-500 mb-4">Review your payment details</p>
            
            <div class="bg-[rgb(var(--bg-3))] p-4 rounded-md mb-6">
              <div class="flex justify-between mb-2">
                <span>Invoice ID:</span>
                <span class="font-semibold">{{ invoice.id }}</span>
              </div>
              <div class="flex justify-between mb-2">
                <span>Description:</span>
                <span class="font-semibold">{{ invoice.description }}</span>
              </div>
              <div class="flex justify-between mb-2">
                <span>Issue Date:</span>
                <span>{{ invoice.date }}</span>
              </div>
              <div class="flex justify-between mb-2">
                <span>Due Date:</span>
                <span>{{ invoice.dueDate }}</span>
              </div>
            </div>
            
            <div class="border-t border-t-[rgb(var(--border-color))] pt-4">
              <div class="flex justify-between mb-2">
                <span>Subtotal:</span>
                <span>RM {{ formatPrice(invoice.amount) }}</span>
              </div>
              <div class="flex justify-between mb-2">
                <span>Tax (0%):</span>
                <span>RM 0.00</span>
              </div>
              <div class="flex justify-between text-lg font-bold mt-3">
                <span>Total:</span>
                <span>RM {{ formatPrice(invoice.amount) }}</span>
              </div>
            </div>
            
            <div class="mt-6">
              <div class="text-base font-semibold mb-2">Payment Method</div>
              <div class="flex items-center bg-[rgb(var(--bg-1))] p-3 rounded">
                <NuxtIcon 
                  :name="paymentMethod.id === 'credit_card' ? 'ic:outline-credit-card' : 
                         paymentMethod.id === 'online_banking' ? 'ic:outline-account-balance' : 
                         'ic:outline-account-balance-wallet'" 
                  class="mr-3 text-xl" 
                />
                <span>{{ paymentMethod.name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </rs-card>
  </div>
</template> 