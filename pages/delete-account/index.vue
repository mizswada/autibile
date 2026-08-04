<script setup>
definePageMeta({
  title: "Account Request — Autibile",
  layout: "empty",
});

useHead({
  title: "Autibile Account Request",
  meta: [
    {
      name: "description",
      content:
        "Submit password reset or account deletion requests for your Autibile mobile app account.",
    },
  ],
});

const activeTab = ref("deletion");

const fullName = ref("");
const email = ref("");
const phoneNumber = ref("");
const accountType = ref("Parents");
const additionalInfo = ref("");
const confirmed = ref(false);
const loading = ref(false);
const error = ref("");
const success = ref("");

const accountTypes = ["Parents", "Doctor", "Therapist"];

async function submitDeletionRequest() {
  error.value = "";
  success.value = "";

  if (!fullName.value.trim() || !email.value.trim()) {
    error.value = "Please enter your full name and the email used for your Autibile account.";
    return;
  }

  if (!confirmed.value) {
    error.value = "Please confirm that you want to permanently delete your account.";
    return;
  }

  loading.value = true;
  try {
    const res = await $fetch("/api/public/account-request", {
      method: "POST",
      body: {
        requestType: "AccountDeletion",
        fullName: fullName.value.trim(),
        email: email.value.trim(),
        accountType: accountType.value,
        additionalInfo: additionalInfo.value.trim(),
        confirmed: confirmed.value,
      },
    });

    if (res.statusCode === 200) {
      success.value = res.message || "Your deletion request has been submitted.";
      fullName.value = "";
      email.value = "";
      additionalInfo.value = "";
      confirmed.value = false;
      accountType.value = "Parents";
    } else {
      error.value = res.message || "Failed to submit request. Please try again.";
    }
  } catch (e) {
    error.value =
      e?.data?.message || e?.message || "An error occurred. Please try again later.";
  } finally {
    loading.value = false;
  }
}

async function submitPasswordResetRequest() {
  error.value = "";
  success.value = "";

  if (!email.value.trim() || !phoneNumber.value.trim()) {
    error.value = "Please enter your account email and registered phone number.";
    return;
  }

  loading.value = true;
  try {
    const res = await $fetch("/api/public/account-request", {
      method: "POST",
      body: {
        requestType: "PasswordReset",
        email: email.value.trim(),
        phoneNumber: phoneNumber.value.trim(),
        accountType: accountType.value,
      },
    });

    if (res.statusCode === 200) {
      success.value =
        res.message ||
        "Your password reset request has been submitted. Once approved, your password will be reset to 12345678.";
      email.value = "";
      phoneNumber.value = "";
      accountType.value = "Parents";
    } else {
      error.value = res.message || "Failed to submit request. Please try again.";
    }
  } catch (e) {
    error.value =
      e?.data?.message || e?.message || "An error occurred. Please try again later.";
  } finally {
    loading.value = false;
  }
}

function submitCurrentTab() {
  if (activeTab.value === "reset") {
    submitPasswordResetRequest();
  } else {
    submitDeletionRequest();
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#E1F5FF] py-10 px-4">
    <div class="max-w-3xl mx-auto">
      <div class="bg-white rounded-2xl shadow-sm px-6 py-8 md:px-10 md:py-10">
        <div class="flex items-center gap-3 mb-6">
          <img
            src="@/assets/img/logo/logo-word-black.png"
            alt="Autibile"
            class="max-w-[110px]"
          />
        </div>

        <h1 class="text-2xl md:text-3xl font-bold text-slate-800 mb-2">
          Account Request
        </h1>
        <p class="text-slate-600 mb-6">
          Submit a password reset or account deletion request for your Autibile mobile app account.
        </p>

        <div class="flex gap-2 mb-8">
          <button
            type="button"
            class="px-4 py-2 rounded-lg text-sm font-semibold"
            :class="activeTab === 'deletion' ? 'bg-[#4db5ff] text-white' : 'bg-slate-100 text-slate-700'"
            @click="activeTab = 'deletion'"
          >
            Account Deletion
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-lg text-sm font-semibold"
            :class="activeTab === 'reset' ? 'bg-[#4db5ff] text-white' : 'bg-slate-100 text-slate-700'"
            @click="activeTab = 'reset'"
          >
            Password Reset
          </button>
        </div>

        <section v-if="activeTab === 'reset'" class="mb-2">
          <h2 class="text-xl font-semibold text-slate-800 mb-2">
            Request password reset
          </h2>
          <p class="text-slate-600 mb-6">
            Enter the email and phone number registered to your account. After an administrator
            approves your request, your password will be reset to
            <strong>12345678</strong>. Please change it after signing in.
          </p>

          <div class="grid grid-cols-1 gap-1">
            <FormKit
              type="email"
              label="Account email"
              v-model="email"
              validation="required|email"
              :classes="{ label: 'text-left', messages: 'text-left' }"
            />
            <FormKit
              type="tel"
              label="Registered phone number"
              v-model="phoneNumber"
              validation="required"
              :classes="{ label: 'text-left', messages: 'text-left' }"
            />
            <FormKit
              type="select"
              label="Account type"
              v-model="accountType"
              :options="accountTypes"
              :classes="{ label: 'text-left', messages: 'text-left' }"
            />
          </div>
        </section>

        <section v-else class="mb-2">
          <h2 class="text-xl font-semibold text-slate-800 mb-2">
            Request account deletion
          </h2>
          <p class="text-slate-600 mb-6">
            Verified deletion requests are processed after administrator approval.
          </p>

          <div class="grid grid-cols-1 gap-1">
            <FormKit
              type="text"
              label="Full name"
              v-model="fullName"
              validation="required"
              :classes="{ label: 'text-left', messages: 'text-left' }"
            />
            <FormKit
              type="email"
              label="Account email"
              v-model="email"
              validation="required|email"
              :classes="{ label: 'text-left', messages: 'text-left' }"
            />
            <FormKit
              type="select"
              label="Account type"
              v-model="accountType"
              :options="accountTypes"
              :classes="{ label: 'text-left', messages: 'text-left' }"
            />
            <FormKit
              type="textarea"
              label="Additional information (optional)"
              v-model="additionalInfo"
              rows="3"
              :classes="{ label: 'text-left', messages: 'text-left' }"
            />
            <FormKit
              type="checkbox"
              v-model="confirmed"
              label="I understand this will permanently delete my Autibile account and associated personal data."
              :classes="{ label: 'text-left', messages: 'text-left' }"
            />
          </div>
        </section>

        <div v-if="error" class="text-red-600 text-left mb-2 mt-4">{{ error }}</div>
        <div v-if="success" class="text-green-700 text-left mb-2 mt-4">{{ success }}</div>

        <FormKit
          type="button"
          input-class="w-full mt-4"
          :disabled="loading"
          @click="submitCurrentTab"
        >
          <span v-if="loading">Submitting...</span>
          <span v-else-if="activeTab === 'reset'">Request password reset</span>
          <span v-else>Request account deletion</span>
        </FormKit>

        <p class="mt-8 text-sm text-slate-500 text-center">
          Autibile · Account requests ·
          <NuxtLink to="/privacy" class="text-primary hover:underline">
            Privacy Policy
          </NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>
