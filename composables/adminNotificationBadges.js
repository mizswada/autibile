export const ADMIN_NOTIFICATION_BADGE_TITLES = {
  paymentPendingCount: "Pending payment approvals",
  diaryUnseenCount: "New diary reports in the last 24 hours",
  accountRequestPendingCount: "Pending account requests",
  userApprovalPendingCount: "Pending user approvals",
  toBillCount: "Appointments waiting to be billed",
};

// A menu item can show a dot for one count (badgeKey) or for any of several (badgeKeys).
function badgeKeysOf(item) {
  if (Array.isArray(item?.badgeKeys)) return item.badgeKeys;
  return item?.badgeKey ? [item.badgeKey] : [];
}

export function hasAdminNotificationBadge(counts, item) {
  return badgeKeysOf(item).some((key) => Number(counts?.[key] || 0) > 0);
}

export function adminNotificationBadgeTitle(item) {
  const keys = badgeKeysOf(item);
  if (keys.length > 1) return "Items need your attention";
  return ADMIN_NOTIFICATION_BADGE_TITLES[keys[0]] || "Pending items";
}
