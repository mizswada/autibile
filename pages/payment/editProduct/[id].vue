<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';

definePageMeta({
  title: "Edit Product",
});

const router = useRouter();
const route = useRoute();
const productId = route.params.id;

const isSubmitting = ref(false);
const isLoading = ref(true);
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

// Fetch product data
const fetchProduct = async () => {
  try {
    const response = await $fetch(`/api/payment/getProduct/${productId}`);
    
    if (response.statusCode === 200) {
      const product = response.data;
      form.value = {
        productName: product.product_name || '',
        description: product.description || '',
        amount: product.amount ? product.amount.toString() : '',
        quantity: product.quantity ? product.quantity.toString() : '',
        status: product.status || '',
      };
    } else {
      showMessage(response.message || 'Failed to fetch product', 'error');
    }
  } catch (error) {
    console.error('Error fetching product:', error);
    showMessage('An error occurred while fetching the product', 'error');
  } finally {
    isLoading.value = false;
  }
};

const updateProduct = async () => {
  isSubmitting.value = true;

  try {
    const response = await $fetch(`/api/payment/updateProduct/${productId}`, {
      method: 'PUT',
      body: {
        productName: form.value.productName,
        description: form.value.description,
        amount: parseFloat(form.value.amount),
        quantity: parseInt(form.value.quantity),
        status: form.value.status,
      },
    });

    if (response.statusCode === 200) {
      showMessage('Product updated successfully', 'success');
      setTimeout(() => {
        router.push('/payment/products');
      }, 1500);
    } else {
      showMessage(response.message || 'Failed to update product', 'error');
    }
  } catch (error) {
    console.error('Error updating product:', error);
    showMessage(error.data?.message || 'An error occurred while updating the product', 'error');
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
  updateProduct();
};

onMounted(() => {
  fetchProduct();
});
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Edit Product</h1>

    <div v-if="isLoading" class="flex justify-center items-center py-12">
      <div class="text-center">
        <NuxtIcon name="line-md:loading-twotone-loop" class="text-4xl mb-4" />
        <p>Loading product data...</p>
      </div>
    </div>

    <div v-else class="card p-4 border border-gray-200">
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
              <span>{{ isSubmitting ? 'Updating...' : 'Update Product' }}</span>
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
