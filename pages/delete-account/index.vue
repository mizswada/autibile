<script setup>
definePageMeta({
  title: "Delete Account — Autibile",
  layout: "empty",
});

useHead({
  title: "Delete Your Autibile Account",
  meta: [
    {
      name: "description",
      content:
        "Request deletion of your Autibile mobile app account and associated personal data.",
    },
  ],
});

const fullName = ref("");
const email = ref("");
const accountType = ref("Parents");
const additionalInfo = ref("");
const confirmed = ref(false);
const loading = ref(false);
const error = ref("");
const success = ref("");

const accountTypes = ["Parents", "Doctor", "Therapist"];

async function submitRequest() {
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
    const res = await $fetch("/api/public/delete-account-request", {
      method: "POST",
      body: {
        fullName: fullName.value.trim(),
        email: email.value.trim(),
        accountType: accountType.value,
        additionalInfo: additionalInfo.value.trim(),
      },
    });

    if (res.statusCode === 200) {
      success.value =
        res.message ||
        "Your deletion request has been submitted. We will process it within 30 days.";
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
          Delete Your Autibile Account
        </h1>
        <p class="text-slate-600 mb-8">
          This page is for users of the <strong>Autibile</strong> mobile application
          (Android package <code class="text-sm bg-slate-100 px-1 rounded">my.autibile.app</code>).
          Use the steps below to request that your account and associated personal data
          are deleted.
        </p>

        <section class="mb-8">
          <h2 class="text-xl font-semibold text-slate-800 mb-3">
            How to request account deletion
          </h2>
          <ol class="list-decimal list-inside space-y-3 text-slate-700">
            <li>
              <strong>Option A — Use this form (recommended if you cannot open the app):</strong>
              Fill in the request form at the bottom of this page with the email address
              registered to your Autibile account and submit it.
            </li>
            <li>
              <strong>Option B — From inside the Autibile app:</strong>
              Sign in → open <em>Profile</em> → <em>Delete Account</em> →
              <em>Continue</em> (opens this page so you can submit the request).
              You can also open this page from the Sign In / user type screens via
              <em>Request account deletion</em>.
            </li>
            <li>
              After we receive your request, we verify ownership of the account and
              process the deletion. You will receive a confirmation email when the
              request is completed (or if we need more information).
            </li>
          </ol>
          <p class="mt-4 text-slate-600">
            Processing time:
            <strong>within 30 days</strong> of a verified request.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-xl font-semibold text-slate-800 mb-3">
            Data that is deleted
          </h2>
          <p class="text-slate-600 mb-3">
            When your account deletion is completed, the following personal data
            associated with your Autibile account is deleted or anonymised:
          </p>
          <ul class="list-disc list-inside space-y-2 text-slate-700">
            <li>Account credentials and profile information (name, email, phone, IC/ID where stored)</li>
            <li>Parent / doctor / therapist profile details</li>
            <li>Linked child / patient profile data that is solely tied to your account</li>
            <li>Appointments, diary reports, progress notes, questionnaire responses, and referrals linked to your account</li>
            <li>Community posts authored under your account</li>
            <li>In-app session and authentication tokens</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-xl font-semibold text-slate-800 mb-3">
            Data that may be retained
          </h2>
          <p class="text-slate-600 mb-3">
            Certain records may be kept for a limited period where required for legal,
            security, or financial compliance:
          </p>
          <ul class="list-disc list-inside space-y-2 text-slate-700">
            <li>
              <strong>Payment / invoice records:</strong> retained up to
              <strong>7 years</strong> where required by applicable tax or accounting laws,
              then deleted or anonymised.
            </li>
            <li>
              <strong>Security / fraud logs:</strong> limited technical logs may be retained
              up to <strong>90 days</strong>.
            </li>
            <li>
              <strong>Aggregated analytics:</strong> non-identifiable statistics that cannot
              reasonably be linked back to you may be retained.
            </li>
            <li>
              Data that belongs to another user’s account (for example a practitioner’s
              clinical notes about a patient who remains under another parent’s account)
              is not deleted as part of your request.
            </li>
          </ul>
        </section>

        <section class="mb-2 border-t border-slate-200 pt-8">
          <h2 class="text-xl font-semibold text-slate-800 mb-2">
            Submit a deletion request
          </h2>
          <p class="text-slate-600 mb-6">
            Submit the form below. We will process verified requests within 30 days.
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
              help="Must match an email registered to an Autibile account."
              :classes="{ label: 'text-left', messages: 'text-left', help: 'text-left' }"
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
              label="I understand this will permanently delete my Autibile account and associated personal data as described above."
              :classes="{ label: 'text-left', messages: 'text-left' }"
            />

            <div v-if="error" class="text-red-600 text-left mb-2">{{ error }}</div>
            <div v-if="success" class="text-green-700 text-left mb-2">{{ success }}</div>

            <FormKit
              type="button"
              input-class="w-full"
              :disabled="loading"
              @click="submitRequest"
            >
              <span v-if="loading">Submitting...</span>
              <span v-else>Request account deletion</span>
            </FormKit>
          </div>
        </section>

        <p class="mt-8 text-sm text-slate-500 text-center">
          Autibile · Account &amp; data deletion
        </p>
      </div>
    </div>
  </div>
</template>
