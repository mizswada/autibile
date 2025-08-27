<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

definePageMeta({
  title: "Create Product",
});

const router = useRouter();
const isSubmitting = ref(false);
const message = ref('');
const messageType = ref('success');

const form = ref({
  productName: '',
  description: '',
  amount: '',
  quantity: '',
  status: '',
});

function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => (message.value = ''), 3000);
}

const saveProduct = async () => {
  isSubmitting.value = true;

  try {
    const response = await $fetch('/api/payment/createProduct', {
      method: 'POST',
      body: {
        productName: form.value.productName,
        description: form.value.description,
        amount: parseFloat(form.value.amount),
        quantity: parseInt(form.value.quantity),
        status: form.value.status,
      },
    });

    if (response.statusCode === 201) {
      showMessage('Product created successfully', 'success');
      Object.keys(form.value).forEach(key => form.value[key] = '');

      setTimeout(() => {
        router.push('/payment/products');
      }, 1500);
    } else {
      showMessage(response.message || 'Failed to create product', 'error');
    }
  } catch (error) {
    console.error('Error creating product:', error);
    showMessage(error.data?.message || 'An error occurred while creating the product', 'error');
  } finally {
    isSubmitting.value = false;
  }
};

const handleClickSubmit = () => {
  const formData = form.value;
  // Manual validation
  if (!formData.productName || !formData.description || !formData.amount || !formData.quantity || !formData.status || formData.status === '-- Please select --') {
    showMessage('Please fill in all required fields.', 'error');
    return;
  }
  saveProduct();
};
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Create New Product</h1>

    <div class="card p-4 border border-gray-200">
      <FormKit type="form" :actions="false">
        <FormKit
          type="text"
          name="productName"
          label="Product Name"
          placeholder="e.g. Therapy Equipment"
          v-model="form.productName"
        />
        <FormKit
          type="text"
          name="description"
          label="Description"
          placeholder="e.g. Professional therapy equipment for sessions"
          v-model="form.description"
        />
        <FormKit
          type="number"
          name="amount"
          label="Amount (RM)"
          placeholder="e.g. 150.00"
          v-model="form.amount"
        />
        <FormKit
          type="number"
          name="quantity"
          label="Quantity"
          placeholder="e.g. 10"
          v-model="form.quantity"
        />
        <FormKit
          type="select"
          name="status"
          label="Status"
          :options="['-- Please select --', 'Active', 'Inactive']"
          v-model="form.status"
        />

        <div class="flex gap-4 mt-6">
          <rs-button
            type="button"
            class="w-full"
            :disabled="isSubmitting"
            @click="handleClickSubmit"
          >
            <div class="flex items-center justify-center">
              <NuxtIcon v-if="isSubmitting" name="line-md:loading-twotone-loop" class="mr-2" />
              <span>{{ isSubmitting ? 'Saving...' : 'Save Product' }}</span>
            </div>
          </rs-button>

          <rs-button
            type="button"
            variant="ghost"
            class="w-full bg-gray-200"
            @click="router.push('/payment/products')"
            :disabled="isSubmitting"
          >
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
