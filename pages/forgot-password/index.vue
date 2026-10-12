<script setup>
// Reset by e-mail is no longer used (password resets go through an account request that an
// administrator approves), so this page just sends people back to the login.
definePageMeta({
  title: "Forgot Password",
  layout: "empty",
  middleware: [() => navigateTo('/login', { replace: true })],
});
</script>

<template>
  <div />
</template>
