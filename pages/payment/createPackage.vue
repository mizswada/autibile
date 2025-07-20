<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

definePageMeta({
  title: "Create Package",
});

const router = useRouter();
const isSubmitting = ref(false);
const message = ref('');
const messageType = ref('success');

const form = ref({
  packageName: '',
  description: '',
  amount: '',
  availableSessions: '',
  status: '',
});

function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => (message.value = ''), 3000);
}

const savePackage = async () => {
  isSubmitting.value = true;

  try {
    const response = await $fetch('/api/payment/createPackage', {
      method: 'POST',
      body: {
        packageName: form.value.packageName,
        description: form.value.description,
        amount: parseFloat(form.value.amount),
        availableSessions: parseInt(form.value.availableSessions),
        status: form.value.status,
      },
    });

    if (response.statusCode === 201) {
      showMessage('Package created successfully', 'success');
      Object.keys(form.value).forEach(key => form.value[key] = '');

      setTimeout(() => {
        router.push('/payment/packages');
      }, 1500);
    } else {
      showMessage(response.message || 'Failed to create package', 'error');
    }
  } catch (error) {
    console.error('Error creating package:', error);
    showMessage(error.data?.message || 'An error occurred while creating the package', 'error');
  } finally {
    isSubmitting.value = false;
  }
};

const handleClickSubmit = () => {
  const formData = form.value;
  // Manual validation
  if (!formData.packageName || !formData.description || !formData.amount || !formData.availableSessions || !formData.status || formData.status === '-- Please select --') {
    showMessage('Please fill in all required fields.', 'error');
    return;
  }
  savePackage();
};
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Create New Package</h1>

    <div class="card p-4 border border-gray-200">
      <FormKit type="form" :actions="false">
        <FormKit
          type="text"
          name="packageName"
          label="Package Name"
          placeholder="e.g. Package 1"
          v-model="form.packageName"
        />
        <FormKit
          type="text"
          name="description"
          label="Description"
          placeholder="e.g. Therapy Session"
          v-model="form.description"
        />
        <FormKit
          type="number"
          name="amount"
          label="Amount (RM)"
          placeholder="e.g. 250.00"
          v-model="form.amount"
        />
        <FormKit
          type="number"
          name="availableSessions"
          label="Available Sessions"
          placeholder="e.g. 4"
          v-model="form.availableSessions"
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
              <span>{{ isSubmitting ? 'Saving...' : 'Save Package' }}</span>
            </div>
          </rs-button>

          <rs-button
            type="button"
            variant="ghost"
            class="w-full bg-gray-200"
            @click="router.push('/payment/packages')"
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
