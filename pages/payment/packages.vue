<script setup>
import { ref, onMounted } from 'vue';

definePageMeta({
  title: "Packages",
});

const packages = ref([]);
const loading = ref(true);
const error = ref('');
const selectedStatus = ref('');

// Fetch packages from API
const fetchPackages = async (status = '') => {
  loading.value = true;
  error.value = '';
  
  try {
    const query = status ? `?status=${status}` : '';
    const response = await $fetch(`/api/payment/listPackages${query}`);
    
    if (response.statusCode === 200) {
      packages.value = response.data;
    } else {
      error.value = response.message || 'Failed to fetch packages';
    }
  } catch (err) {
    console.error('Error fetching packages:', err);
    error.value = 'An error occurred while fetching packages';
  } finally {
    loading.value = false;
  }
};

const filterByStatus = (status) => {
  selectedStatus.value = status;
  fetchPackages(status);
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
  fetchPackages();
});
</script>

<template>
  <main>
    <LayoutsBreadcrumb />

    <rs-card class="p-6">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
        <h5 class="text-xl font-semibold mb-4 md:mb-0">Packages Management</h5>
        <div class="flex flex-wrap gap-2">
          <NuxtLink to="/payment/createPackage">
            <rs-button variant="primary" size="sm">
              <NuxtIcon name="ic:outline-add" class="mr-1" />
              Create New Package
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
          <p>Loading packages...</p>
        </div>
      </section>

      <section v-else-if="error" class="flex justify-center items-center py-12">
        <div class="text-center text-red-500">
          <NuxtIcon name="ic:outline-error" class="text-4xl mb-4" />
          <p>{{ error }}</p>
          <rs-button @click="fetchPackages" class="mt-4">
            Try Again
          </rs-button>
        </div>
      </section>

      <section v-else-if="packages.length === 0" class="flex justify-center items-center py-12">
        <div class="text-center text-gray-500">
          <NuxtIcon name="ic:outline-package" class="text-4xl mb-4" />
          <p>No packages found</p>
          <NuxtLink to="/payment/createPackage">
            <rs-button class="mt-4">
              Create Your First Package
            </rs-button>
          </NuxtLink>
        </div>
      </section>

      <!-- Packages Grid -->
      <section v-else class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <rs-card 
          v-for="pkg in packages" 
          :key="pkg.package_id"
          class="hover:shadow-lg transition-shadow cursor-pointer p-4 flex flex-col justify-between"
        >
          <!-- Card Top -->
          <div>
            <div class="flex justify-between items-start mb-4">
              <div>
                <h6 class="font-medium text-lg mb-1">{{ pkg.package_name }}</h6>
                <rs-badge 
                  :variant="pkg.status === 'Active' ? 'success' : 'warning'"
                  class="text-xs"
                >
                  {{ pkg.status }}
                </rs-badge>
              </div>
              <div class="text-right">
                <div class="text-2xl font-bold text-primary">
                  RM {{ formatPrice(pkg.amount) }}
                </div>
                <div class="text-sm text-gray-500">
                  {{ pkg.avail_session }} sessions
                </div>
              </div>
            </div>

            <p class="text-gray-600 mb-4 line-clamp-2">
              {{ pkg.description }}
            </p>

            <div class="space-y-2 text-sm text-gray-500">
              <div class="flex justify-between">
                <span>Package ID:</span>
                <span class="font-mono">#{{ pkg.package_id }}</span>
              </div>
              <div class="flex justify-between">
                <span>Created:</span>
                <span>{{ formatDate(pkg.created_at) }}</span>
              </div>
              <div class="flex justify-between">
                <span>Last Updated:</span>
                <span>{{ formatDate(pkg.updated_at) }}</span>
              </div>
            </div>
          </div>

          <!-- Card Actions -->
          <div class="flex gap-2 mt-6">
            <rs-button 
              variant="outline" 
              size="sm" 
              class="flex-1 bg-primary text-white"
              @click="() => $router.push(`/payment/editPackage/${pkg.package_id}`)"
            >
              <NuxtIcon name="ic:outline-edit" class="mr-1" />
              Edit
            </rs-button>
            <rs-button 
              variant="outline" 
              size="sm" 
              class="flex-1 bg-primary text-white"
              @click="() => $router.push(`/payment/viewPackage/${pkg.package_id}`)"
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
