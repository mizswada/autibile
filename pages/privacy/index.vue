<script setup>
definePageMeta({
  title: "Privacy Policy — Autibile",
  layout: "empty",
});

useHead({
  title: "Autibile Privacy Policy",
  meta: [
    {
      name: "description",
      content:
        "Privacy Policy for the Autibile mobile application describing how we collect, use, store, and delete personal data.",
    },
  ],
});

const lastUpdated = "21 July 2026";
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
          Privacy Policy
        </h1>
        <p class="text-slate-500 mb-8">
          Last updated: {{ lastUpdated }}
        </p>

        <p class="text-slate-700 mb-6">
          This Privacy Policy explains how <strong>Autibile</strong>
          (Android package
          <code class="text-sm bg-slate-100 px-1 rounded">my.autibile.app</code>,
          website
          <a href="https://autibile.my" class="text-primary underline">https://autibile.my</a>)
          collects, uses, stores, and shares personal information when you use
          the Autibile mobile application and related services.
        </p>

        <section class="mb-8">
          <h2 class="text-xl font-semibold text-slate-800 mb-3">
            1. Who we are
          </h2>
          <p class="text-slate-700">
            Autibile is an autism care and screening support platform used by
            parents/caregivers, doctors, and therapists. For privacy questions,
            contact us via the support contacts listed in the app
            (<em>Contact Us</em>) or through
            <a href="https://autibile.my/delete-account" class="text-primary underline"
              >https://autibile.my/delete-account</a
            >
            for account/data deletion requests.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-xl font-semibold text-slate-800 mb-3">
            2. Information we collect
          </h2>
          <p class="text-slate-700 mb-3">
            Depending on your role (Parent, Doctor, or Therapist), we may collect:
          </p>
          <ul class="list-disc list-inside space-y-2 text-slate-700">
            <li>
              <strong>Account information:</strong> full name, email address,
              phone number, password (stored hashed), and identity details such as
              IC/ID where provided.
            </li>
            <li>
              <strong>Parent / caregiver profile:</strong> relationship, gender,
              date of birth, nationality, and address details.
            </li>
            <li>
              <strong>Child / patient information:</strong> name, nickname,
              gender, date of birth, diagnosis-related details, OKU card status,
              treatment type, and linked questionnaire access.
            </li>
            <li>
              <strong>Practitioner information:</strong> registration number,
              specialty, department, workplace, qualifications, experience, and
              signature where provided.
            </li>
            <li>
              <strong>Service data:</strong> appointments, diary reports,
              progress notes, referrals, autism screening / questionnaire
              responses and results, and community posts you create.
            </li>
            <li>
              <strong>Payment data:</strong> invoices, package/product purchases,
              and payment references processed through our payment flow.
              We do not store full card numbers on Autibile servers unless a
              payment provider explicitly requires a tokenised reference.
            </li>
            <li>
              <strong>Technical data:</strong> authentication tokens/sessions and
              basic device/app technical logs needed to operate and secure the
              service.
            </li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-xl font-semibold text-slate-800 mb-3">
            3. How we use information
          </h2>
          <ul class="list-disc list-inside space-y-2 text-slate-700">
            <li>Create and manage your Autibile account</li>
            <li>Provide screening, appointment, reporting, and care coordination features</li>
            <li>Allow authorised parents and practitioners to access relevant patient-linked records</li>
            <li>Process payments and keep financial records where required</li>
            <li>Provide customer support and respond to account or data requests</li>
            <li>Maintain security, prevent fraud/abuse, and improve service reliability</li>
            <li>Comply with applicable legal obligations</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-xl font-semibold text-slate-800 mb-3">
            4. How we share information
          </h2>
          <p class="text-slate-700 mb-3">
            We do not sell personal data. We may share information only as needed to
            operate Autibile:
          </p>
          <ul class="list-disc list-inside space-y-2 text-slate-700">
            <li>
              With authorised users linked to a care relationship (for example, a
              parent and an assigned doctor/therapist viewing relevant patient records)
            </li>
            <li>
              With service providers who help us host, email, or process payments,
              under appropriate confidentiality and security obligations
            </li>
            <li>
              When required by law, regulation, or lawful request from authorities
            </li>
            <li>
              To protect the rights, safety, or security of users, children in care,
              or Autibile
            </li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-xl font-semibold text-slate-800 mb-3">
            5. Data retention
          </h2>
          <p class="text-slate-700 mb-3">
            We keep personal data only as long as needed for the purposes above, or
            as required by law:
          </p>
          <ul class="list-disc list-inside space-y-2 text-slate-700">
            <li>
              Account and care records are retained while your account is active
            </li>
            <li>
              After a verified account deletion request, personal account data is
              deleted or anonymised within <strong>30 days</strong>
            </li>
            <li>
              Payment/invoice records may be retained up to <strong>7 years</strong>
              for tax or accounting compliance
            </li>
            <li>
              Limited security/technical logs may be retained up to
              <strong>90 days</strong>
            </li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-xl font-semibold text-slate-800 mb-3">
            6. Your rights and account deletion
          </h2>
          <p class="text-slate-700 mb-3">
            You may request access to, correction of, or deletion of your personal
            data, subject to legal limits.
          </p>
          <p class="text-slate-700 mb-3">
            To request deletion of your Autibile account and associated personal
            data, use:
          </p>
          <p class="mb-3">
            <a
              href="https://autibile.my/delete-account"
              class="text-primary underline font-medium"
            >
              https://autibile.my/delete-account
            </a>
          </p>
          <p class="text-slate-700">
            You can also open that page from the Autibile app Sign In screen
            (<em>Request account deletion</em>) or from Profile → Delete Account.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-xl font-semibold text-slate-800 mb-3">
            7. Children’s information
          </h2>
          <p class="text-slate-700">
            Autibile may process information about children in the context of
            autism screening and care, submitted by a parent/caregiver or
            authorised practitioner. This information is used only to provide the
            requested care and screening services. Parents/caregivers are
            responsible for ensuring they have authority to provide a child’s
            information.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-xl font-semibold text-slate-800 mb-3">
            8. Security
          </h2>
          <p class="text-slate-700">
            We use reasonable technical and organisational measures to protect
            personal data, including authenticated access and hashed passwords.
            No method of transmission or storage is completely secure; please keep
            your login credentials confidential.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-xl font-semibold text-slate-800 mb-3">
            9. Changes to this policy
          </h2>
          <p class="text-slate-700">
            We may update this Privacy Policy from time to time. The “Last updated”
            date at the top of this page will change when we do. Continued use of
            Autibile after an update means you acknowledge the revised policy.
          </p>
        </section>

        <section class="mb-2">
          <h2 class="text-xl font-semibold text-slate-800 mb-3">
            10. Contact
          </h2>
          <p class="text-slate-700">
            For privacy questions or data requests, contact Autibile support through
            the in-app <em>Contact Us</em> section, or submit an account deletion
            request at
            <a href="https://autibile.my/delete-account" class="text-primary underline"
              >https://autibile.my/delete-account</a
            >.
          </p>
        </section>

        <div class="mt-10 pt-6 border-t border-slate-200 flex flex-wrap gap-4 justify-center text-sm">
          <NuxtLink to="/delete-account" class="text-primary hover:underline">
            Request account deletion
          </NuxtLink>
          <NuxtLink to="/login" class="text-primary hover:underline">
            Admin login
          </NuxtLink>
        </div>

        <p class="mt-6 text-sm text-slate-500 text-center">
          Autibile · Privacy Policy
        </p>
      </div>
    </div>
  </div>
</template>
