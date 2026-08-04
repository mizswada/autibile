-- Rename table and indexes to match unified Account Requests feature
RENAME TABLE `account_deletion_requests` TO `account_requests`;

ALTER TABLE `account_requests`
  RENAME INDEX `idx_account_deletion_requests_status` TO `idx_account_requests_status`,
  RENAME INDEX `idx_account_deletion_requests_email` TO `idx_account_requests_email`;
