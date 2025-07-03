<script setup>
definePageMeta({
  title: "Reset Password",
  layout: "empty",
  middleware: ["dashboard"],
});

import { ref } from 'vue'
import { useRouter } from 'vue-router'

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

const router = useRouter()

async function onSubmit() {
  error.value = ''
  success.value = ''
  loading.value = true
  try {
    const res = await $fetch('/api/auth/resetPassword', {
      method: 'POST',
      body: { email: email.value, password: password.value, confirmPassword: confirmPassword.value }
    })
    if (res.status === 200) {
      success.value = res.message
      setTimeout(() => {
        router.push('/login')
      }, 1500)
    } else {
      error.value = res.message || 'Reset failed'
    }
  } catch (e) {
    error.value = e.data?.message || 'An error occurred'
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
        <h3 class="mb-4">Reset Password</h3>
        <p class="text-slate-500 mb-6">
          Please fill in the form to reset your password.
        </p>
        <div class="grid grid-cols-1">
          <FormKit
            label="Email"
            type="email"
            outer-class="text-left"
            v-model="email"
          />
          <FormKit
            label="Password"
            type="password"
            outer-class="text-left"
            v-model="password"
          />
          <FormKit
            label="Re-enter Password"
            type="password"
            outer-class="text-left"
            v-model="confirmPassword"
          />
          <div v-if="error" class="text-red-500 mb-2">{{ error }}</div>
          <div v-if="success" class="text-green-600 mb-2">{{ success }}</div>
          <FormKit
            type="button"
            input-class="w-full"
            :disabled="loading"
            @click="onSubmit"
          >
            <span v-if="loading">Resetting...</span>
            <span v-else>Reset Password</span>
          </FormKit>
          <NuxtLink to="/login" class="block mt-4 text-blue-500 underline">
            Back to Login
          </NuxtLink>
        </div>
      </rs-card>
    </div>
  </div>
</template>
