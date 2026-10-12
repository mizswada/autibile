<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';

definePageMeta({
  title: "Create Invoice",
});

const router = useRouter();
const route = useRoute();
const { $swal } = useNuxtApp();
const isSubmitting = ref(false);

// Patient / item names come from the database or the user, so escape them before putting them in HTML.
const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
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

// Sessions the package rows give: also the most appointments this invoice can bill.
const packageSessions = computed(() =>
  items.value.reduce((sum, row) => {
    if (row.type !== 'Package') return sum;
    const pkg = findPackage(row);
    return sum + (pkg ? (pkg.avail_session || 0) * (parseInt(row.qty, 10) || 0) : 0);
  }, 0),
);

// Appointments booked without a prepaid session that this patient still has to be billed for.
const unbilled = ref([]);
const selectedAppointmentIds = ref([]);
const selectedCount = computed(() => selectedAppointmentIds.value.length);
const coverageShortBy = computed(() => Math.max(0, selectedCount.value - packageSessions.value));

const formatSessionDate = (value) =>
  new Date(value).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });

async function loadUnbilled(patientId, preselect = null) {
  unbilled.value = [];
  selectedAppointmentIds.value = [];
  if (!patientId) return;

  try {
    const response = await $fetch(`/api/appointments/unbilled?patient_id=${patientId}`);
    if (response.success) {
      unbilled.value = response.data;
      const ids = response.data.map((appointment) => appointment.appointment_id);
      // Nothing is ticked unless the admin came from a specific session (deep link), so a
      // product-only invoice for a patient with unbilled sessions needs no unticking.
      selectedAppointmentIds.value = preselect && preselect.length
        ? ids.filter((id) => preselect.includes(id))
        : [];
      autoFillPackageRow();
    }
  } catch (error) {
    console.error('Error fetching unbilled appointments:', error);
  }
}

// With sessions to bill and an empty first row, suggest the single-session package.
function autoFillPackageRow() {
  const row = items.value[0];
  if (!selectedCount.value || !row || row.type !== 'Package' || row.refId) return;
  const single = packages.value.find((pkg) => pkg.status === 'Active' && pkg.avail_session === 1);
  if (!single) return;
  row.refId = String(single.package_id);
  row.unitPrice = String(single.amount ?? '');
  row.qty = selectedCount.value;
}

// Ticking the first session suggests the single-session package (only into an empty row).
watch(selectedCount, (count, previous) => {
  if (previous === 0 && count > 0) autoFillPackageRow();
});

function selectAllUnbilled() {
  selectedAppointmentIds.value = unbilled.value.map((appointment) => appointment.appointment_id);
}

function clearUnbilledSelection() {
  selectedAppointmentIds.value = [];
}

// Set the first package row's quantity so its sessions cover the selected appointments.
function matchPackageQuantity() {
  const row = items.value.find((item) => item.type === 'Package' && findPackage(item));
  if (!row) {
    showMessage('Add a therapy package row first.', 'error');
    return;
  }
  const perPackage = findPackage(row).avail_session || 1;
  row.qty = Math.max(1, Math.ceil(selectedCount.value / perPackage));
}

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

  if (!form.value.invoiceDate) {
    form.value.invoiceDate = new Date().toISOString().slice(0, 10);
  }

  // Deep link from the appointment screen / To Bill list: ?patientId=12&appointmentIds=5,6
  // Setting the patient triggers the watcher below, which loads that patient's unbilled sessions.
  const queryPatient = route.query.patientId;
  if (queryPatient) {
    pendingPreselect = String(route.query.appointmentIds || '')
      .split(',')
      .map((id) => parseInt(id, 10))
      .filter((id) => Number.isInteger(id));
    form.value.patientID = String(queryPatient);
  }

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

// Handle patient selection. This runs from a watcher on the selected patient (a FormKit
// @change listener receives the browser event, not the value), so it works for both a
// user choosing a patient and the patient being preselected from the URL.
let pendingPreselect = null;
watch(() => form.value.patientID, (patientID) => {
  const preselect = pendingPreselect;
  pendingPreselect = null;
  handlePatientChange(patientID, preselect);
});

const handlePatientChange = async (patientID, preselect = null) => {
  if (patientID) {
    const selectedPatient = patients.value.find(p => p.childID === parseInt(patientID));
    if (selectedPatient) {
      form.value.patientName = selectedPatient.fullname;
      // Zakat patients get the Zakat label by default (it can still be changed).
      form.value.payLater = !!selectedPatient.isZakat;
    }
    await loadUnbilled(patientID, Array.isArray(preselect) ? preselect : null);
  } else {
    form.value.patientName = '';
    form.value.payLater = false;
    await loadUnbilled(null);
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
// event payload, so this does not depend on when v-model updates the row. The quantity is
// left alone (it may have been set to match the appointments being billed).
function handleItemChange(row, pickedId) {
  if (row.type === 'Package') {
    const pkg = packages.value.find((item) => String(item.package_id) === String(pickedId));
    row.unitPrice = pkg ? String(pkg.amount ?? '') : '';
  } else if (row.type === 'Product') {
    const product = products.value.find((item) => String(item.product_id) === String(pickedId));
    row.unitPrice = product ? String(product.amount ?? '') : '';
  }
}

const saveInvoice = async (goToPayment = false) => {
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

  // The invoice must give at least as many sessions as the appointments it bills.
  if (selectedCount.value > packageSessions.value) {
    showMessage(
      `The invoice covers ${packageSessions.value} session(s) but ${selectedCount.value} appointment(s) are selected. Add package sessions or untick some appointments.`,
      'error',
    );
    return;
  }

  // Ask before creating anything (both buttons).
  const itemLines = payloadItems
    .map((item, index) => {
      const row = items.value[index];
      const name = row.type === 'Package' ? findPackage(row)?.package_name
        : row.type === 'Product' ? findProduct(row)?.product_name
        : row.name.trim();
      return `<li>${escapeHtml(name)}${item.qty > 1 ? ` × ${item.qty}` : ''} — RM ${(item.qty * item.unitPrice).toFixed(2)}</li>`;
    })
    .join('');

  const confirmation = await $swal.fire({
    title: goToPayment === true ? 'Create invoice and record payment?' : 'Create invoice?',
    html: `
      <div style="text-align:left; font-size:14px; line-height:1.7;">
        <p><strong>Patient:</strong> ${escapeHtml(form.value.patientName)}</p>
        <p><strong>Date:</strong> ${escapeHtml(form.value.invoiceDate)}</p>
        <ul style="margin:6px 0 6px 18px; list-style:disc;">${itemLines}</ul>
        <p><strong>Total:</strong> RM ${totalAmount.value.toFixed(2)}${form.value.payLater ? ' &nbsp;<em>(Zakat)</em>' : ''}</p>
        ${selectedCount.value ? `<p><strong>Bills:</strong> ${selectedCount.value} appointment(s) booked without a prepaid session</p>` : ''}
        <hr style="margin:8px 0;" />
        <p style="color:#b45309;">${goToPayment === true
          ? 'The invoice is created as <strong>Unpaid</strong>, then you go to the payment form to record the payment. It is only Paid after you confirm there.'
          : 'The invoice is created as <strong>Unpaid</strong>. Sessions are added only when the payment is recorded.'}</p>
      </div>
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#2E7D32',
    cancelButtonColor: '#d33',
    confirmButtonText: goToPayment === true ? 'Yes, create and record payment' : 'Yes, create invoice',
    cancelButtonText: 'Cancel',
  });

  if (!confirmation.isConfirmed) return;

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
        appointmentIds: selectedAppointmentIds.value,
      },
    });

    if (response.statusCode === 201) {
      showMessage(response.message || 'Invoice created successfully', 'success');

      // Redirect immediately without resetting form. "Save and record payment" goes straight
      // to the payment form for this invoice (payment received at the counter).
      const target = goToPayment === true
        ? `/payment/paymentForm?invoiceId=${response.data.invoice_id}`
        : '/payment';
      setTimeout(() => {
        router.push(target);
      }, goToPayment === true ? 400 : 1500);
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
        />

        <FormKit type="date" v-model="form.invoiceDate" label="Date" validation="required" />

        <!-- Appointments booked without a prepaid session: this invoice can bill them -->
        <div v-if="unbilled.length" class="p-3 mb-4 border border-amber-300 bg-amber-50 rounded-md">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h2 class="font-semibold text-amber-900">Bill unbilled sessions</h2>
            <span class="text-sm text-amber-900">
              {{ selectedCount }} selected / {{ packageSessions }} session(s) on this invoice
            </span>
          </div>
          <p class="text-xs text-amber-800 mb-2">
            These appointments were booked when the patient had no sessions left. Tick the ones this invoice bills, and add a therapy package row for the price (for example the single-session package). Leave all unticked for an invoice that is not for these sessions (for example a product).
          </p>
          <label
            v-for="appointment in unbilled"
            :key="appointment.appointment_id"
            class="flex items-center gap-2 text-sm py-1 cursor-pointer"
          >
            <input
              v-model="selectedAppointmentIds"
              type="checkbox"
              :value="appointment.appointment_id"
              class="rounded border-gray-300"
            />
            <span>{{ formatSessionDate(appointment.date) }}</span>
            <span class="text-gray-600">{{ appointment.time_slot }} · {{ appointment.service_name }}</span>
          </label>
          <div class="flex flex-wrap items-center gap-3 mt-2">
            <rs-button size="sm" variant="primary-outline" @click="selectAllUnbilled">Select all</rs-button>
            <rs-button size="sm" variant="primary-outline" @click="clearUnbilledSelection">Clear</rs-button>
            <rs-button size="sm" variant="primary-outline" @click="matchPackageQuantity">Match package quantity</rs-button>
            <span v-if="coverageShortBy > 0" class="text-sm text-red-700">
              Short by {{ coverageShortBy }} session(s): add package sessions or untick appointments.
            </span>
          </div>
        </div>

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

        <!-- Zakat is only a label (it defaults to the patient's Zakat flag) -->
        <div class="p-3 bg-purple-50 border border-purple-200 rounded-md mb-4">
          <FormKit
            type="checkbox"
            v-model="form.payLater"
            label="Zakat"
            help="Label only. Sessions are credited when the payment is recorded."
          />
        </div>

        <!-- Invoices are always created as Unpaid. Admin must record payment via
             the "Make a Payment" flow so a receipt is generated. -->
        <div class="p-3 bg-amber-50 border border-amber-200 rounded-md mb-2">
          <p class="text-sm text-amber-800">
            <span class="font-medium">Note:</span> This invoice will be created as
            <span class="font-semibold">Unpaid</span>. To mark it as paid, use
            <span class="font-medium">Make a Payment</span> so a receipt is issued and
            the patient's sessions are counted.
          </p>
        </div>

        <div class="flex flex-col sm:flex-row gap-4 mt-6">
          <rs-button class="w-full" @click="saveInvoice(false)" :disabled="isSubmitting">
            <div class="flex items-center justify-center">
              <Icon v-if="isSubmitting" name="line-md:loading-twotone-loop" class="mr-2" />
              <span>{{ isSubmitting ? 'Saving...' : 'Save Invoice' }}</span>
            </div>
          </rs-button>

          <rs-button class="w-full" variant="success" @click="saveInvoice(true)" :disabled="isSubmitting">
            Save and record payment
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
