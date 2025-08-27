<script setup>
import { ref, onMounted } from 'vue';

definePageMeta({
  title: "Products",
});

const products = ref([]);
const loading = ref(true);
const error = ref('');
const selectedStatus = ref('');

// Fetch products from API
const fetchProducts = async (status = '') => {
  loading.value = true;
  error.value = '';
  
  try {
    const query = status ? `?status=${status}` : '';
    const response = await $fetch(`/api/payment/listProducts${query}`);
    
    if (response.statusCode === 200) {
      products.value = response.data;
    } else {
      error.value = response.message || 'Failed to fetch products';
    }
  } catch (err) {
    console.error('Error fetching products:', err);
    error.value = 'An error occurred while fetching products';
  } finally {
    loading.value = false;
  }
};

const filterByStatus = (status) => {
  selectedStatus.value = status;
  fetchProducts(status);
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
    month: 'short',
    day: 'numeric',
  });
};

onMounted(() => {
  fetchProducts();
});
</script>

<template>
  <main>
    <LayoutsBreadcrumb />

    <rs-card class="p-6">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
        <h5 class="text-xl font-semibold mb-4 md:mb-0">Products Management</h5>
        <div class="flex flex-wrap gap-2">
          <NuxtLink to="/payment/createProduct">
            <rs-button variant="primary" size="sm">
              <NuxtIcon name="ic:outline-add" class="mr-1" />
              Create New Product
            </rs-button>
          </NuxtLink>
          <NuxtLink to="/payment">
            <rs-button variant="ghost" size="sm">
              <NuxtIcon name="ic:outline-arrow-back" class="mr-1" />
              Back to Payment
            </rs-button>
          </NuxtLink>
        </div>
      </div>

      <!-- Filter -->
      <div class="flex gap-2 mb-6">
        <rs-button 
          variant="ghost" 
          size="sm"
          :class="selectedStatus === '' ? 'bg-primary text-white' : ''"
          @click="filterByStatus('')"
        >
          All
        </rs-button>
        <rs-button 
          variant="ghost" 
          size="sm"
          :class="selectedStatus === 'Active' ? 'bg-primary text-white' : ''"
          @click="filterByStatus('Active')"
        >
          Active
        </rs-button>
        <rs-button 
          variant="ghost" 
          size="sm"
          :class="selectedStatus === 'Inactive' ? 'bg-primary text-white' : ''"
          @click="filterByStatus('Inactive')"
        >
          Inactive
        </rs-button>
      </div>

      <!-- States -->
      <section v-if="loading" class="flex justify-center items-center py-12">
        <div class="text-center">
          <NuxtIcon name="line-md:loading-twotone-loop" class="text-4xl mb-4" />
          <p>Loading products...</p>
        </div>
      </section>

      <section v-else-if="error" class="flex justify-center items-center py-12">
        <div class="text-center text-red-500">
          <NuxtIcon name="ic:outline-error" class="text-4xl mb-4" />
          <p>{{ error }}</p>
          <rs-button @click="fetchProducts" class="mt-4">
            Try Again
          </rs-button>
        </div>
      </section>

      <section v-else-if="products.length === 0" class="flex justify-center items-center py-12">
        <div class="text-center text-gray-500">
          <NuxtIcon name="ic:outline-inventory" class="text-4xl mb-4" />
          <p>No products found</p>
          <NuxtLink to="/payment/createProduct">
            <rs-button class="mt-4">
              Create Your First Product
            </rs-button>
          </NuxtLink>
        </div>
      </section>

      <!-- Products Grid -->
      <section v-else class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <rs-card 
          v-for="product in products" 
          :key="product.product_id"
          class="hover:shadow-lg transition-shadow cursor-pointer p-4 flex flex-col justify-between"
        >
          <!-- Card Top -->
          <div>
            <div class="flex justify-between items-start mb-4">
              <div>
                <h6 class="font-medium text-lg mb-1">{{ product.product_name }}</h6>
                <rs-badge 
                  :variant="product.status === 'Active' ? 'success' : 'warning'"
                  class="text-xs"
                >
                  {{ product.status }}
                </rs-badge>
              </div>
              <div class="text-right">
                <div class="text-2xl font-bold text-primary">
                  RM {{ formatPrice(product.amount) }}
                </div>
                <div class="text-sm text-gray-500">
                  Qty: {{ product.quantity }}
                </div>
              </div>
            </div>

            <p class="text-gray-600 mb-4 line-clamp-2">
              {{ product.description }}
            </p>

            <div class="space-y-2 text-sm text-gray-500">
              <div class="flex justify-between">
                <span>Product ID:</span>
                <span class="font-mono">#{{ product.product_id }}</span>
              </div>
              <div class="flex justify-between">
                <span>Created:</span>
                <span>{{ formatDate(product.created_at) }}</span>
              </div>
              <div class="flex justify-between">
                <span>Last Updated:</span>
                <span>{{ formatDate(product.updated_at) }}</span>
              </div>
            </div>
          </div>

          <!-- Card Actions -->
          <div class="flex gap-2 mt-6">
            <rs-button 
              variant="outline" 
              size="sm" 
              class="flex-1 bg-primary text-white"
              @click="() => $router.push(`/payment/editProduct/${product.product_id}`)"
            >
              <NuxtIcon name="ic:outline-edit" class="mr-1" />
              Edit
            </rs-button>
            <rs-button 
              variant="outline" 
              size="sm" 
              class="flex-1 bg-primary text-white"
              @click="() => $router.push(`/payment/viewProduct/${product.product_id}`)"
            >
              <NuxtIcon name="ic:outline-visibility" class="mr-1" />
              View
            </rs-button>
          </div>
        </rs-card>
      </section>
    </rs-card>
  </main>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
