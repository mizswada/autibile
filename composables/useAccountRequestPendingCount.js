const POLL_INTERVAL_MS = 60000;

/**
 * Tracks how many account requests are still pending, for the sidemenu indicator.
 * Only admins can read the endpoint, so polling stays disabled for everyone else.
 */
export function useAccountRequestPendingCount(isEnabled = () => true) {
  const pendingCount = ref(0);
  let intervalId = null;

  async function refreshPendingCount() {
    if (!isEnabled()) {
      pendingCount.value = 0;
      return;
    }

    try {
      const result = await $fetch("/api/accountRequests/pendingCount");
      pendingCount.value =
        result.statusCode === 200 ? result.data?.pendingCount || 0 : 0;
    } catch (error) {
      console.error("Failed to load account request pending count:", error);
    }
  }

  function stopPolling() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  onMounted(() => {
    watch(
      isEnabled,
      (enabled) => {
        stopPolling();
        if (!enabled) {
          pendingCount.value = 0;
          return;
        }
        refreshPendingCount();
        intervalId = setInterval(refreshPendingCount, POLL_INTERVAL_MS);
      },
      { immediate: true }
    );
  });

  onUnmounted(stopPolling);

  return {
    pendingCount,
    refreshPendingCount,
  };
}
