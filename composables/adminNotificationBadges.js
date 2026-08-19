export const ADMIN_NOTIFICATION_BADGE_TITLES = {
  paymentPendingCount: "Pending payment approvals",
  diaryUnseenCount: "New diary reports in the last 24 hours",
  accountRequestPendingCount: "Pending account requests",
  userApprovalPendingCount: "Pending user approvals",
};

export function hasAdminNotificationBadge(counts, item) {
  if (!item?.badgeKey) return false;
  return Number(counts?.[item.badgeKey] || 0) > 0;
}

export function adminNotificationBadgeTitle(item) {
  return ADMIN_NOTIFICATION_BADGE_TITLES[item?.badgeKey] || "Pending items";
}
