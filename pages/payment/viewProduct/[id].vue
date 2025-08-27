<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';

definePageMeta({
  title: "View Product",
});

const router = useRouter();
const route = useRoute();
const productId = route.params.id;

const product = ref(null);
const isLoading = ref(true);
const error = ref('');

const formatPrice = (price) => {
  return parseFloat(price)
    .toFixed(2)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Fetch product data
const fetchProduct = async () => {
  try {
    const response = await $fetch(`/api/payment/getProduct/${productId}`);
    
    if (response.statusCode === 200) {
      product.value = response.data;
    } else {
      error.value = response.message || 'Failed to fetch product';
    }
  } catch (err) {
    console.error('Error fetching product:', err);
    error.value = 'An error occurred while fetching the product';
  } finally {
    isLoading.value = false;
  }
};

const deleteProduct = async () => {
  if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
    return;
  }

  try {
    const response = await $fetch(`/api/payment/deleteProduct/${productId}`, {
      method: 'DELETE',
    });

    if (response.statusCode === 200) {
      alert('Product deleted successfully');
      router.push('/payment/products');
    } else {
      alert(response.message || 'Failed to delete product');
    }
  } catch (error) {
    console.error('Error deleting product:', error);
    alert('An error occurred while deleting the product');
  }
};

onMounted(() => {
  fetchProduct();
});
</script>

<template>
  <main>
    <LayoutsBreadcrumb />

    <rs-card class="p-6">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
        <h5 class="text-xl font-semibold mb-4 md:mb-0">Product Details</h5>
        <div class="flex flex-wrap gap-2">
          <rs-button 
            variant="outline" 
            size="sm"
            @click="() => $router.push(`/payment/editProduct/${productId}`)"
          >
            <NuxtIcon name="ic:outline-edit" class="mr-1" />
            Edit Product
          </rs-button>
          <rs-button 
            variant="ghost" 
            size="sm"
            @click="() => $router.push('/payment/products')"
          >
            <NuxtIcon name="ic:outline-arrow-back" class="mr-1" />
            Back to Products
          </rs-button>
        </div>
      </div>

      <!-- Loading State -->
      <section v-if="isLoading" class="flex justify-center items-center py-12">
        <div class="text-center">
          <NuxtIcon name="line-md:loading-twotone-loop" class="text-4xl mb-4" />
          <p>Loading product details...</p>
        </div>
      </section>

      <!-- Error State -->
      <section v-else-if="error" class="flex justify-center items-center py-12">
        <div class="text-center text-red-500">
          <NuxtIcon name="ic:outline-error" class="text-4xl mb-4" />
          <p>{{ error }}</p>
          <rs-button @click="fetchProduct" class="mt-4">
            Try Again
          </rs-button>
        </div>
      </section>

      <!-- Product Details -->
      <section v-else-if="product" class="space-y-6">
        <!-- Product Header -->
        <div class="bg-gray-50 p-6 rounded-lg">
          <div class="flex flex-col md:flex-row md:justify-between md:items-start">
            <div>
              <h1 class="text-3xl font-bold text-gray-900 mb-2">{{ product.product_name }}</h1>
              <rs-badge 
                :variant="product.status === 'Active' ? 'success' : 'warning'"
                class="text-sm"
              >
                {{ product.status }}
              </rs-badge>
            </div>
            <div class="text-right mt-4 md:mt-0">
              <div class="text-4xl font-bold text-primary">
                RM {{ formatPrice(product.amount) }}
              </div>
              <div class="text-lg text-gray-500">
                Quantity: {{ product.quantity }}
              </div>
            </div>
          </div>
        </div>

        <!-- Product Description -->
        <div class="bg-white p-6 border border-gray-200 rounded-lg">
          <h3 class="text-lg font-semibold text-gray-900 mb-3">Description</h3>
          <p class="text-gray-700 leading-relaxed">{{ product.description }}</p>
        </div>

        <!-- Product Information -->
        <div class="bg-white p-6 border border-gray-200 rounded-lg">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Product Information</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span class="text-sm font-medium text-gray-500">Product ID</span>
              <p class="text-base font-mono">#{{ product.product_id }}</p>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-500">Status</span>
              <p class="text-base">{{ product.status }}</p>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-500">Amount</span>
              <p class="text-base font-semibold">RM {{ formatPrice(product.amount) }}</p>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-500">Quantity</span>
              <p class="text-base">{{ product.quantity }}</p>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-500">Created Date</span>
              <p class="text-base">{{ formatDate(product.created_at) }}</p>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-500">Last Updated</span>
              <p class="text-base">{{ formatDate(product.updated_at) }}</p>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-col sm:flex-row gap-3">
          <rs-button 
            variant="outline" 
            class="flex-1"
            @click="() => $router.push(`/payment/editProduct/${productId}`)"
          >
            <NuxtIcon name="ic:outline-edit" class="mr-2" />
            Edit Product
          </rs-button>
          <rs-button 
            variant="danger" 
            class="flex-1"
            @click="deleteProduct"
          >
            <NuxtIcon name="ic:outline-delete" class="mr-2" />
            Delete Product
          </rs-button>
        </div>
      </section>
    </rs-card>
  </main>
</template>
