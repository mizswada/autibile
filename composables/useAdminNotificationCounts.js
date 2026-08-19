const POLL_INTERVAL_MS = 60000;

function emptyCounts() {
  return {
    paymentPendingCount: 0,
    diaryUnseenCount: 0,
    accountRequestPendingCount: 0,
    userApprovalPendingCount: 0,
    diaryUnseenPatientIds: [],
  };
}

/**
 * Tracks pending inbound admin items for sidemenu red-dot indicators.
 * Only admins can read the endpoint, so polling stays disabled for everyone else.
 */
export function useAdminNotificationCounts(isEnabled = () => true) {
  const counts = reactive(emptyCounts());
  let intervalId = null;

  function resetCounts() {
    Object.assign(counts, emptyCounts());
  }

  async function refreshCounts() {
    if (!isEnabled()) {
      resetCounts();
      return;
    }

    try {
      const result = await $fetch("/api/admin/notifications/counts");
      if (result.statusCode === 200 && result.data) {
        counts.paymentPendingCount = result.data.paymentPendingCount || 0;
        counts.diaryUnseenCount = result.data.diaryUnseenCount || 0;
        counts.accountRequestPendingCount =
          result.data.accountRequestPendingCount || 0;
        counts.userApprovalPendingCount =
          result.data.userApprovalPendingCount || 0;
        counts.diaryUnseenPatientIds = Array.isArray(
          result.data.diaryUnseenPatientIds
        )
          ? result.data.diaryUnseenPatientIds
          : [];
        return;
      }
      resetCounts();
    } catch (error) {
      console.error("Failed to load admin notification counts:", error);
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
          resetCounts();
          return;
        }
        refreshCounts();
        intervalId = setInterval(refreshCounts, POLL_INTERVAL_MS);
      },
      { immediate: true }
    );
  });

  onUnmounted(stopPolling);

  return {
    counts,
    refreshCounts,
  };
}
