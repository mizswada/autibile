<script setup>
definePageMeta({
  title: "Forgot Password",
  layout: "empty",
  middleware: ["dashboard"],
});

import { ref } from 'vue'

const email = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

async function onSendEmail() {
  error.value = ''
  success.value = ''
  loading.value = true
  try {
    const res = await $fetch('/api/auth/sendResetEmail', {
      method: 'POST',
      body: { email: email.value }
    })
    if (res.status === 200) {
      success.value = 'Verification email sent. Please check your inbox.'
    } else {
      error.value = res.message || 'Failed to send email.'
    }
  } catch (e) {
    error.value = e.data?.message || 'An error occurred.'
  }
  loading.value = false
}
</script>

<template>
  <div
    class="flex-none md:flex justify-center text-center items-center h-screen"
  >
    <div class="w-full md:w-3/4 lg:w-1/2 xl:w-2/6 relative">
      <rs-card class="h-screen md:h-auto px-10 md:px-16 py-12 md:py-20 mb-0">
        <div
          class="absolute -bottom-3 left-3 img-container flex justify-start items-center mb-5"
        >
          <img
            src="@/assets/img/logo/logo-word-black.svg"
            class="max-w-[90px]"
          />
        </div>
        <h3 class="mb-4">Forgot Password</h3>
        <p class="text-slate-500 mb-6">
          Please input the correct email to reset the password.
        </p>
        <div class="grid grid-cols-1">
          <FormKit
            label="Email"
            type="email"
            outer-class="text-left"
            v-model="email"
          />
          <div v-if="error" class="text-red-500 mb-2">{{ error }}</div>
          <div v-if="success" class="text-green-600 mb-2">{{ success }}</div>
          <FormKit
            type="button"
            input-class="w-full"
            :disabled="loading"
            @click="onSendEmail"
          >
            <span v-if="loading">Sending...</span>
            <span v-else>Send Email</span>
          </FormKit>
        </div>
        <p class="mt-3 text-center text-slate-500">
          Already have an account?
          <NuxtLink to="/login" class="text-primary hover:underline"
            >Login</NuxtLink
          >
        </p>
      </rs-card>
    </div>
  </div>
</template>
