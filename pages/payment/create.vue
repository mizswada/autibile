<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';

definePageMeta({
  title: "Create Invoice",
});

const router = useRouter();
const isSubmitting = ref(false);
const message = ref('');
const messageType = ref('success');

// Data for dropdowns
const patients = ref([]);
const packages = ref([]);
const products = ref([]);
const isLoading = ref(true);

const form = ref({
  patientID: '',
  patientName: '',
  invoiceType: '',
  customInvoiceType: '',
  description: '',
  amount: '',
  invoiceDate: '',
  status: '',
});

// Computed properties
const invoiceTypeOptions = computed(() => {
  const options = [{ label: '-- Please select --', value: '' }];
  
  // Add package names
  packages.value.forEach(pkg => {
    if (pkg.status === 'Active') {
      options.push({ label: pkg.package_name, value: pkg.package_name });
    }
  });
  
  // Add product names
  products.value.forEach(product => {
    if (product.status === 'Active') {
      options.push({ label: product.product_name, value: product.product_name });
    }
  });
  
  // Add "Other" option
  options.push({ label: 'Other', value: 'Other' });
  
  return options;
});

const selectedPackage = computed(() => {
  if (form.value.invoiceType && form.value.invoiceType !== 'Other' && form.value.invoiceType !== '') {
    return packages.value.find(pkg => pkg.package_name === form.value.invoiceType);
  }
  return null;
});

const selectedProduct = computed(() => {
  if (form.value.invoiceType && form.value.invoiceType !== 'Other' && form.value.invoiceType !== '') {
    return products.value.find(product => product.product_name === form.value.invoiceType);
  }
  return null;
});

function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => (message.value = ''), 3000);
}

// Fetch data on mount
onMounted(async () => {
  await Promise.all([
    fetchPatients(),
    fetchPackages(),
    fetchProducts()
  ]);
  isLoading.value = false;
});

async function fetchPatients() {
  try {
    const response = await $fetch('/api/parents/manageChild/listChild');
    if (response.statusCode === 200) {
      patients.value = response.data;
    } else {
      console.error('Failed to fetch patients:', response.message);
    }
  } catch (error) {
    console.error('Error fetching patients:', error);
  }
}

async function fetchPackages() {
  try {
    const response = await $fetch('/api/payment/listPackages');
    if (response.statusCode === 200) {
      packages.value = response.data;
    } else {
      console.error('Failed to fetch packages:', response.message);
    }
  } catch (error) {
    console.error('Error fetching packages:', error);
  }
}

async function fetchProducts() {
  try {
    const response = await $fetch('/api/payment/listProducts');
    if (response.statusCode === 200) {
      products.value = response.data;
    } else {
      console.error('Failed to fetch products:', response.message);
    }
  } catch (error) {
    console.error('Error fetching products:', error);
  }
}

// Handle patient selection
const handlePatientChange = (patientID) => {
  console.log('Patient changed to:', patientID);
  console.log('Available patients:', patients.value);
  
  if (patientID) {
    const selectedPatient = patients.value.find(p => p.childID === parseInt(patientID));
    console.log('Selected patient:', selectedPatient);
    if (selectedPatient) {
      form.value.patientName = selectedPatient.fullname;
      console.log('Set patient name to:', selectedPatient.fullname);
    }
  } else {
    form.value.patientName = '';
  }
};

// Handle invoice type change
const handleInvoiceTypeChange = (invoiceType) => {
  console.log('Invoice type changed to:', invoiceType);
  if (invoiceType === 'Other') {
    form.value.customInvoiceType = '';
    form.value.amount = '';
  } else if (invoiceType && invoiceType !== '') {
    // Check if it's a package
    const packageData = selectedPackage.value;
    if (packageData) {
      form.value.amount = packageData.amount.toString();
      form.value.description = packageData.description || '';
      return;
    }
    
    // Check if it's a product
    const productData = selectedProduct.value;
    if (productData) {
      form.value.amount = productData.amount.toString();
      form.value.description = productData.description || '';
    }
  }
};

const saveInvoice = async () => {
  // Debug: Log form data
  console.log('Form data before submission:', form.value);
  
  // Fallback: Set patient name if missing but patientID is selected
  if (form.value.patientID && !form.value.patientName) {
    const selectedPatient = patients.value.find(p => p.childID === parseInt(form.value.patientID));
    if (selectedPatient) {
      form.value.patientName = selectedPatient.fullname;
      console.log('Fallback: Set patient name to:', selectedPatient.fullname);
    }
  }
  
  // Validate form data
  if (!form.value.patientID || !form.value.invoiceType || !form.value.description || 
      !form.value.amount || !form.value.invoiceDate || !form.value.status || 
      form.value.status === '' || form.value.invoiceType === '') {
    console.log('Validation failed. Missing fields:', {
      patientID: !!form.value.patientID,
      patientName: !!form.value.patientName,
      invoiceType: !!form.value.invoiceType,
      description: !!form.value.description,
      amount: !!form.value.amount,
      invoiceDate: !!form.value.invoiceDate,
      status: !!form.value.status,
      statusValue: form.value.status,
      invoiceTypeValue: form.value.invoiceType
    });
    showMessage('Please fill in all required fields.', 'error');
    return;
  }

  // Validate custom invoice type if "Other" is selected
  if (form.value.invoiceType === 'Other' && !form.value.customInvoiceType) {
    showMessage('Please enter a custom invoice type.', 'error');
    return;
  }

  // Validate amount is a positive number
  const amountValue = parseFloat(form.value.amount);
  if (isNaN(amountValue) || amountValue <= 0) {
    showMessage('Amount must be a positive number.', 'error');
    return;
  }

  isSubmitting.value = true;

  try {
    const requestBody = {
      patientID: parseInt(form.value.patientID),
      patientName: form.value.patientName,
      invoiceType: form.value.invoiceType === 'Other' ? form.value.customInvoiceType : form.value.invoiceType,
      description: form.value.description,
      amount: amountValue,
      date: form.value.invoiceDate,
      status: form.value.status,
    };
    
    console.log('Request body:', requestBody);
    
    const response = await $fetch('/api/payment/createInvoice', {
      method: 'POST',
      body: requestBody,
    });

    if (response.statusCode === 201) {
      showMessage('Invoice created successfully', 'success');
      
      // Redirect immediately without resetting form
      setTimeout(() => {
        router.push('/payment');
      }, 1500);
    } else {
      showMessage(response.message || 'Failed to create invoice', 'error');
    }
  } catch (error) {
    console.error('Error creating invoice:', error);
    showMessage(error.data?.message || 'An error occurred while creating the invoice', 'error');
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Create New Invoice</h1>

    <div v-if="isLoading" class="flex justify-center items-center py-12">
      <div class="text-center">
        <NuxtIcon name="line-md:loading-twotone-loop" class="text-4xl mb-4" />
        <p>Loading form data...</p>
      </div>
    </div>

    <div v-else class="card p-4 border border-gray-200">
      <FormKit type="form" :actions="false">
        <!-- Patient Selection -->
        <FormKit 
          type="select" 
          v-model="form.patientID" 
          label="Patient" 
          placeholder="Select a patient"
          :options="[
            { label: '-- Please select --', value: '' },
            ...patients.map(p => ({ 
              label: `${p.fullname} (${p.parentUsername})`, 
              value: p.childID.toString() 
            }))
          ]"
          validation="required"
          @change="handlePatientChange"
        />

        <!-- Invoice Type Selection -->
        <FormKit 
          type="select" 
          v-model="form.invoiceType" 
          label="Invoice Type" 
          placeholder="Select invoice type"
          :options="invoiceTypeOptions"
          validation="required|not:-- Please select --"
          @change="handleInvoiceTypeChange"
        />

        <!-- Custom Invoice Type (shown when "Other" is selected) -->
        <FormKit 
          v-if="form.invoiceType === 'Other'"
          type="text" 
          v-model="form.customInvoiceType" 
          label="Custom Invoice Type" 
          placeholder="e.g. Consultation Fee, Equipment Rental"
          validation="required"
        />

        <!-- Package Info (shown when a package is selected) -->
        <div v-if="selectedPackage" class="p-3 bg-blue-50 border border-blue-200 rounded-md mb-4">
          <h6 class="font-medium text-blue-800 mb-2">Package Information</h6>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div><span class="font-medium">Package:</span> {{ selectedPackage.package_name }}</div>
            <div><span class="font-medium">Sessions:</span> {{ selectedPackage.avail_session }}</div>
            <div><span class="font-medium">Amount:</span> RM {{ selectedPackage.amount }}</div>
            <div><span class="font-medium">Status:</span> {{ selectedPackage.status }}</div>
          </div>
        </div>

        <!-- Product Info (shown when a product is selected) -->
        <div v-if="selectedProduct" class="p-3 bg-green-50 border border-green-200 rounded-md mb-4">
          <h6 class="font-medium text-green-800 mb-2">Product Information</h6>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div><span class="font-medium">Product:</span> {{ selectedProduct.product_name }}</div>
            <div><span class="font-medium">Quantity:</span> {{ selectedProduct.quantity }}</div>
            <div><span class="font-medium">Amount:</span> RM {{ selectedProduct.amount }}</div>
            <div><span class="font-medium">Status:</span> {{ selectedProduct.status }}</div>
          </div>
        </div>

        <FormKit type="text" v-model="form.description" label="Description" placeholder="e.g. Therapy Session" validation="required" />
        <FormKit type="number" v-model="form.amount" label="Amount (RM)" placeholder="e.g. 250.00" validation="required|number|min:0.01" />
        <FormKit type="date" v-model="form.invoiceDate" label="Date" validation="required" />
        <FormKit type="select" v-model="form.status" label="Status" :options="[
          { label: '-- Please select --', value: '' },
          { label: 'Paid', value: 'Paid' },
          { label: 'Unpaid', value: 'Unpaid' }
        ]" validation="required|not:" />

        <div class="flex gap-4 mt-6">
          <rs-button class="w-full" @click="saveInvoice" :disabled="isSubmitting">
            <div class="flex items-center justify-center">
              <NuxtIcon v-if="isSubmitting" name="line-md:loading-twotone-loop" class="mr-2" />
              <span>{{ isSubmitting ? 'Saving...' : 'Save Invoice' }}</span>
            </div>
          </rs-button>

          <rs-button variant="ghost" class="w-full bg-gray-200" @click="router.push('/payment')" :disabled="isSubmitting">
            Cancel
          </rs-button>
        </div>

        <div v-if="message" class="mt-4 p-3 rounded text-white"
             :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
          {{ message }}
        </div>
      </FormKit>
    </div>
  </div>
</template>

