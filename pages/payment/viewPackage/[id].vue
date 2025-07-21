<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';

definePageMeta({
  title: "View Package",
});

const router = useRouter();
const route = useRoute();
const isLoading = ref(true);
const message = ref('');
const messageType = ref('success');
const showDeleteConfirm = ref(false);
const isDeleting = ref(false);
const packageId = route.params.id;
const packageData = ref(null);

function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => (message.value = ''), 3000);
}

const fetchPackage = async () => {
  isLoading.value = true;
  try {
    const response = await $fetch(`/api/payment/getPackage/${packageId}`);
    if (response.statusCode === 200) {
      packageData.value = response.data;
    } else {
      showMessage('Failed to load package data', 'error');
      router.push('/payment/packages');
    }
  } catch (error) {
    console.error('Error fetching package:', error);
    showMessage('An error occurred while loading the package', 'error');
    router.push('/payment/packages');
  } finally {
    isLoading.value = false;
  }
};

const deletePackage = async () => {
  isDeleting.value = true;
  try {
    const response = await $fetch(`/api/payment/deletePackage/${packageId}`, { method: 'DELETE' });
    if (response.statusCode === 200) {
      showMessage('Package deleted successfully', 'success');
      setTimeout(() => router.push('/payment/packages'), 1500);
    } else {
      showMessage(response.message || 'Failed to delete package', 'error');
    }
  } catch (error) {
    console.error('Error deleting package:', error);
    showMessage(error.data?.message || 'An error occurred while deleting the package', 'error');
  } finally {
    isDeleting.value = false;
    showDeleteConfirm.value = false;
  }
};

const formatPrice = (price) =>
  parseFloat(price).toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString('en-MY', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

onMounted(() => {
  fetchPackage();
});
</script>

<template>
  <main class="p-6">
    <!-- Page Header -->
    <header class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
      <h1 class="text-2xl font-bold mb-4 md:mb-0">Package Details</h1>
      <rs-button variant="ghost" @click="router.push('/payment/packages')" size="sm">
        <NuxtIcon name="ic:outline-arrow-back" class="mr-1" />
        Back to Packages
      </rs-button>
    </header>

    <!-- Loading State -->
    <section v-if="isLoading" class="flex justify-center items-center py-12">
      <div class="text-center">
        <NuxtIcon name="line-md:loading-twotone-loop" class="text-4xl mb-4" />
        <p>Loading package data...</p>
      </div>
    </section>

    <!-- Package Details -->
    <section v-else-if="packageData" class="space-y-6">
      <!-- Main Package Card -->
      <rs-card class="p-6">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            <h2 class="text-3xl font-bold text-gray-800 mb-2">{{ packageData.package_name }}</h2>
            <rs-badge :variant="packageData.status === 'Active' ? 'success' : 'warning'" class="text-sm">
              {{ packageData.status }}
            </rs-badge>
          </div>
          <div class="text-right">
            <div class="text-4xl font-bold text-primary">RM {{ formatPrice(packageData.amount) }}</div>
            <div class="text-lg text-gray-600">{{ packageData.avail_session }} sessions</div>
          </div>
        </div>
      </rs-card>

      <!-- Details Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Package Information -->
        <rs-card class="p-6">
          <h3 class="text-lg font-semibold mb-4">Package Information</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Package ID</label>
              <p class="text-lg font-mono text-gray-900">#{{ packageData.package_id }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <p class="text-gray-900">{{ packageData.description }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <p class="text-2xl font-bold text-primary">RM {{ formatPrice(packageData.amount) }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Available Sessions</label>
              <p class="text-lg text-gray-900">{{ packageData.avail_session }} sessions</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <rs-badge :variant="packageData.status === 'Active' ? 'success' : 'warning'">
                {{ packageData.status }}
              </rs-badge>
            </div>
          </div>
        </rs-card>

        <!-- Timeline -->
        <rs-card class="p-6">
          <h3 class="text-lg font-semibold mb-4">Timeline</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Created</label>
              <p class="text-gray-900">{{ formatDate(packageData.created_at) }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
              <p class="text-gray-900">{{ formatDate(packageData.updated_at) }}</p>
            </div>
          </div>
        </rs-card>
      </div>

      <!-- Action Buttons -->
      <rs-card class="p-6">
        <div class="flex flex-col sm:flex-row gap-4">
          <rs-button 
            variant="primary" 
            @click="router.push(`/payment/editPackage/${packageId}`)" 
            class="flex-1"
          >
            <NuxtIcon name="ic:outline-edit" class="mr-2" />
            Edit Package
          </rs-button>
          <rs-button 
            variant="danger" 
            @click="showDeleteConfirm = true" 
            class="flex-1"
          >
            <NuxtIcon name="ic:outline-delete" class="mr-2" />
            Delete Package
          </rs-button>
        </div>
      </rs-card>
    </section>

    <!-- Delete Confirmation Modal -->
    <transition name="fade">
      <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto flex items-center justify-center px-4">
        <div class="bg-white rounded-lg p-6 max-w-md w-full">
          <div class="flex items-center mb-4">
            <NuxtIcon name="ic:outline-warning" class="text-red-500 text-2xl mr-3" />
            <h3 class="text-lg font-semibold">Confirm Deletion</h3>
          </div>
          <p class="text-gray-600 mb-6">
            Are you sure you want to delete the package "{{ packageData?.package_name }}"? This action cannot be undone.
          </p>
          <div class="flex flex-col sm:flex-row gap-3">
            <rs-button variant="ghost" @click="showDeleteConfirm = false" :disabled="isDeleting" class="flex-1">
              Cancel
            </rs-button>
            <rs-button variant="danger" @click="deletePackage" :disabled="isDeleting" class="flex-1">
              <NuxtIcon v-if="isDeleting" name="line-md:loading-twotone-loop" class="mr-2" />
              {{ isDeleting ? 'Deleting...' : 'Delete' }}
            </rs-button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Message Toast -->
    <transition name="fade">
      <div v-if="message" class="fixed top-4 right-4 p-4 rounded text-white z-50"
           :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
        {{ message }}
      </div>
    </transition>
  </main>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
