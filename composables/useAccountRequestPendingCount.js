export function useAccountRequestPendingCount() {
  const pendingCount = ref(0);
  let intervalId = null;

  async function refreshPendingCount() {
    try {
      const result = await $fetch("/api/accountDeletionRequests/pendingCount");
      if (result.statusCode === 200) {
        pendingCount.value = result.data?.pendingCount || 0;
      }
    } catch (error) {
      console.error("Failed to load account request pending count:", error);
    }
  }

  onMounted(() => {
    refreshPendingCount();
    intervalId = window.setInterval(refreshPendingCount, 60000);
  });

  onUnmounted(() => {
    if (intervalId) {
      window.clearInterval(intervalId);
    }
  });

  return {
    pendingCount,
    refreshPendingCount,
  };
}
