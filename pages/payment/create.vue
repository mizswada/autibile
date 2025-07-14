<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

definePageMeta({
  title: "Create Invoice",
});

const router = useRouter();
const isSubmitting = ref(false);
const message = ref('');
const messageType = ref('success');

const form = ref({
  invoiceID: '',
  description: '',
  amount: '',
  dueDate: '',
  status: '',
});

function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => (message.value = ''), 3000);
}

const saveInvoice = () => {
  isSubmitting.value = true;

  // Simulate form submission delay
  setTimeout(() => {
    console.log('Dummy invoice created:', form.value);
    showMessage('Invoice created successfully (dummy action)', 'success');

    // Reset form
    form.value = {
      invoiceID: '',
      description: '',
      amount: '',
      dueDate: '',
      status: '',
    };

    isSubmitting.value = false;
  }, 1000);
};
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Create New Invoice</h1>

    <div class="card p-4 border border-gray-200">
      <FormKit type="form" :actions="false">
        <FormKit type="text" v-model="form.invoiceID" label="Invoice ID" placeholder="e.g. INV-004" validation="required" />
        <FormKit type="text" v-model="form.description" label="Description" placeholder="e.g. Therapy Session" validation="required" />
        <FormKit type="number" v-model="form.amount" label="Amount (RM)" placeholder="e.g. 250.00" validation="required" />
        <FormKit type="date" v-model="form.dueDate" label="Due Date" validation="required" />
        <FormKit type="select" v-model="form.status" label="Status" :options="['-- Please select --', 'Paid', 'Unpaid']" validation="required" />

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

