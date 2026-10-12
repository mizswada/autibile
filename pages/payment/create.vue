<script setup>
import { ref, onMounted, computed, watch } from 'vue';
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
  invoiceDate: '',
  notes: '',
  payLater: false,
});

// One invoice can hold several rows: therapy packages, products and other charges.
let rowKey = 0;
const newRow = (type = 'Package') => ({
  key: ++rowKey,
  type,
  refId: '', // package_id / product_id (as string) for Package / Product rows
  name: '', // free text for "Other" rows
  qty: 1,
  unitPrice: '',
  description: '',
});
const items = ref([newRow()]);

const rowTypeOptions = [
  { label: 'Therapy Package', value: 'Package' },
  { label: 'Product', value: 'Product' },
  { label: 'Other', value: 'Other' },
];

const packageOptions = computed(() => [
  { label: '-- Select a therapy package --', value: '' },
  ...packages.value
    .filter((pkg) => pkg.status === 'Active')
    .map((pkg) => ({ label: pkg.package_name, value: String(pkg.package_id) })),
]);

const productOptions = computed(() => [
  { label: '-- Select a product --', value: '' },
  ...products.value
    .filter((product) => product.status === 'Active')
    .map((product) => ({ label: product.product_name, value: String(product.product_id) })),
]);

const findPackage = (row) => packages.value.find((pkg) => String(pkg.package_id) === String(row.refId));
const findProduct = (row) => products.value.find((product) => String(product.product_id) === String(row.refId));

const rowSubtotal = (row) => {
  const qty = parseInt(row.qty, 10);
  const price = parseFloat(row.unitPrice);
  if (isNaN(qty) || isNaN(price) || qty < 1 || price <= 0) return 0;
  return Math.round(qty * price * 100) / 100;
};

const totalAmount = computed(() => items.value.reduce((sum, row) => sum + rowSubtotal(row), 0));

const totalSessions = computed(() =>
  items.value.reduce((sum, row) => {
    if (row.type !== 'Package') return sum;
    const pkg = findPackage(row);
    return sum + (pkg ? (pkg.avail_session || 0) * (parseInt(row.qty, 10) || 0) : 0);
  }, 0),
);

// Pay later (Zakat) only makes sense when the invoice credits therapy sessions.
const hasPackageRow = computed(() =>
  items.value.some((row) => row.type === 'Package' && findPackage(row)),
);
watch(hasPackageRow, (value) => {
  if (!value) form.value.payLater = false;
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
    const response = await $fetch('/api/parents/manageChild/listChild?activeOnly=true');
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
  if (patientID) {
    const selectedPatient = patients.value.find(p => p.childID === parseInt(patientID));
    if (selectedPatient) {
      form.value.patientName = selectedPatient.fullname;
    }
  } else {
    form.value.patientName = '';
  }
};

function addItem() {
  items.value.push(newRow('Product'));
}

function removeItem(index) {
  if (items.value.length > 1) {
    items.value.splice(index, 1);
  }
}

// Changing the row type starts the row over.
function handleTypeChange(row) {
  row.refId = '';
  row.name = '';
  row.qty = 1;
  row.unitPrice = '';
  row.description = '';
}

// Picking a package / product fills in the catalog price. The picked id comes from the
// event payload, so this does not depend on when v-model updates the row.
function handleItemChange(row, pickedId) {
  if (row.type === 'Package') {
    const pkg = packages.value.find((item) => String(item.package_id) === String(pickedId));
    row.unitPrice = pkg ? String(pkg.amount ?? '') : '';
    row.qty = 1;
  } else if (row.type === 'Product') {
    const product = products.value.find((item) => String(item.product_id) === String(pickedId));
    row.unitPrice = product ? String(product.amount ?? '') : '';
  }
}

const saveInvoice = async () => {
  // Fallback: Set patient name if missing but patientID is selected
  if (form.value.patientID && !form.value.patientName) {
    const selectedPatient = patients.value.find(p => p.childID === parseInt(form.value.patientID));
    if (selectedPatient) {
      form.value.patientName = selectedPatient.fullname;
    }
  }

  if (!form.value.patientID || !form.value.invoiceDate) {
    showMessage('Please select a patient and a date.', 'error');
    return;
  }

  const payloadItems = [];
  for (let i = 0; i < items.value.length; i++) {
    const row = items.value[i];
    const label = `Item ${i + 1}`;

    if (row.type === 'Package' && !findPackage(row)) {
      showMessage(`${label}: please select a therapy package.`, 'error');
      return;
    }
    if (row.type === 'Product' && !findProduct(row)) {
      showMessage(`${label}: please select a product.`, 'error');
      return;
    }
    if (row.type === 'Other' && !row.name.trim()) {
      showMessage(`${label}: please enter a name.`, 'error');
      return;
    }
    const qty = parseInt(row.qty, 10);
    if (isNaN(qty) || qty < 1) {
      showMessage(`${label}: quantity must be at least 1.`, 'error');
      return;
    }
    const price = parseFloat(row.unitPrice);
    if (isNaN(price) || price <= 0) {
      showMessage(`${label}: price must be greater than 0.`, 'error');
      return;
    }

    payloadItems.push({
      type: row.type,
      packageId: row.type === 'Package' ? parseInt(row.refId, 10) : undefined,
      productId: row.type === 'Product' ? parseInt(row.refId, 10) : undefined,
      name: row.type === 'Other' ? row.name.trim() : undefined,
      qty,
      unitPrice: price,
      description: row.description?.trim() || undefined,
    });
  }

  isSubmitting.value = true;

  try {
    const response = await $fetch('/api/payment/createInvoice', {
      method: 'POST',
      body: {
        patientID: parseInt(form.value.patientID),
        patientName: form.value.patientName,
        date: form.value.invoiceDate,
        notes: form.value.notes,
        payLater: form.value.payLater,
        items: payloadItems,
      },
    });

    if (response.statusCode === 201) {
      showMessage(response.message || 'Invoice created successfully', 'success');

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
        <Icon name="line-md:loading-twotone-loop" class="text-4xl mb-4" />
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
              label: p.parentFullName ? `${p.fullname} (${p.parentFullName})` : p.fullname,
              value: p.childID.toString()
            }))
          ]"
          validation="required"
          @change="handlePatientChange"
        />

        <FormKit type="date" v-model="form.invoiceDate" label="Date" validation="required" />

        <!-- Invoice items: therapy packages, products and other charges on one invoice -->
        <div class="mb-4">
          <div class="flex items-center justify-between mb-2">
            <h2 class="font-semibold text-lg">Invoice Items</h2>
            <rs-button variant="primary-outline" size="sm" @click="addItem">
              <Icon name="material-symbols:add" class="mr-1" /> Add item
            </rs-button>
          </div>

          <div
            v-for="(row, index) in items"
            :key="row.key"
            class="p-3 mb-3 border rounded-md"
            :class="row.type === 'Package' ? 'bg-blue-50 border-blue-200' : row.type === 'Product' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="font-medium text-sm">Item {{ index + 1 }}</span>
              <button
                v-if="items.length > 1"
                type="button"
                class="text-red-600 hover:text-red-800 text-sm flex items-center"
                @click="removeItem(index)"
              >
                <Icon name="material-symbols:delete-outline" class="mr-1" /> Remove
              </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-12 gap-x-4">
              <div class="md:col-span-3">
                <FormKit
                  type="select"
                  v-model="row.type"
                  label="Type"
                  :options="rowTypeOptions"
                  @input="handleTypeChange(row)"
                />
              </div>

              <div class="md:col-span-5">
                <FormKit
                  v-if="row.type === 'Package'"
                  type="select"
                  v-model="row.refId"
                  label="Therapy package"
                  :options="packageOptions"
                  @input="(value) => handleItemChange(row, value)"
                />
                <FormKit
                  v-else-if="row.type === 'Product'"
                  type="select"
                  v-model="row.refId"
                  label="Product"
                  :options="productOptions"
                  @input="(value) => handleItemChange(row, value)"
                />
                <FormKit
                  v-else
                  type="text"
                  v-model="row.name"
                  label="Name"
                  placeholder="e.g. Consultation Fee, Equipment Rental"
                />
              </div>

              <div class="md:col-span-1">
                <FormKit
                  type="number"
                  v-model="row.qty"
                  label="Qty"
                  min="1"
                  :disabled="row.type === 'Package'"
                />
              </div>

              <div class="md:col-span-3">
                <FormKit
                  type="number"
                  v-model="row.unitPrice"
                  label="Unit price (RM)"
                  placeholder="e.g. 250.00"
                  step="0.01"
                  :disabled="row.type === 'Product'"
                />
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span v-if="row.type === 'Package' && findPackage(row)" class="text-blue-800">
                Credits {{ (findPackage(row).avail_session || 0) * (parseInt(row.qty, 10) || 0) }} session(s) to the patient
                <NuxtLink :to="`/payment/editPackage/${findPackage(row).package_id}`" class="underline font-medium ml-1">Edit package</NuxtLink>
              </span>
              <span v-else-if="row.type === 'Product'" class="text-green-800">Price comes from the product.</span>
              <span v-else />
              <span class="font-medium">Subtotal: RM {{ rowSubtotal(row).toFixed(2) }}</span>
            </div>
          </div>

          <div class="flex items-center justify-between p-3 bg-gray-100 rounded-md font-semibold">
            <span>Total</span>
            <span>RM {{ totalAmount.toFixed(2) }}</span>
          </div>
        </div>

        <FormKit type="text" v-model="form.notes" label="Notes (optional)" placeholder="Anything to add to the invoice description" />

        <!-- Zakat: sessions are given now, the invoice stays Unpaid until the money arrives -->
        <div v-if="hasPackageRow" class="p-3 bg-purple-50 border border-purple-200 rounded-md mb-4">
          <FormKit
            type="checkbox"
            v-model="form.payLater"
            label="Pay later (Zakat)"
            :help="`The patient gets ${totalSessions} session(s) now. The invoice stays Unpaid until the payment is recorded.`"
          />
        </div>

        <!-- Invoices are always created as Unpaid. Admin must record payment via
             the "Make a Payment" flow so a receipt is generated. -->
        <div class="p-3 bg-amber-50 border border-amber-200 rounded-md mb-2">
          <p class="text-sm text-amber-800">
            <span class="font-medium">Note:</span> This invoice will be created as
            <span class="font-semibold">Unpaid</span>. To mark it as paid, use
            <span class="font-medium">Make a Payment</span> so a receipt is issued<template v-if="!form.payLater"> and
            the patient's sessions are counted</template>.
          </p>
        </div>

        <div class="flex gap-4 mt-6">
          <rs-button class="w-full" @click="saveInvoice" :disabled="isSubmitting">
            <div class="flex items-center justify-center">
              <Icon v-if="isSubmitting" name="line-md:loading-twotone-loop" class="mr-2" />
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
