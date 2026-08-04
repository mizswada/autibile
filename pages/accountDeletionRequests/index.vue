<script setup>
// Legacy path kept so existing bookmarks and links keep working.
definePageMeta({
  middleware: () => navigateTo("/accountRequests", { replace: true }),
});
</script>

<template>
  <div />
</template>
