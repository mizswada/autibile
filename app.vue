<script setup>
useHead({
  title: "Autibile",
  htmlAttrs: {
    lang: "en",
  },
  meta: [
    {
      name: "description",
      content:
        "Autibile is a therapy and autism screening platform for parents, doctors, and therapists to manage appointments, screenings, diary reports, and care records.",
    },
    {
      name: "google-site-verification",
      content: "Ye_NPj_76H17L1-oQoUHpXWedFhZV5ubU72vqBB2iuY",
    },
  ],
});

// Apply role-based middleware globally
definePageMeta({
  middleware: ['role']
});

const nuxtApp = useNuxtApp();
const loading = ref(true);

onMounted(() => {
  // Hide loading indicator if not hydrating
  setTimeout(() => {
    loading.value = false;
  }, 1000);

  // Get theme from localStorage
  let theme = localStorage.getItem("theme") || "default";
  document.documentElement.setAttribute("data-theme", theme);
});
</script>

<template>
  <div>
    <VitePwaManifest />
    <NuxtLoadingIndicator />
    <NuxtLayout>
      <Loading v-if="loading" />
      <NuxtPage :key="$route.fullPath" v-else />
    </NuxtLayout>
  </div>
</template>
