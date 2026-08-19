ALTER TABLE `diary_report`
  ADD COLUMN `admin_seen_at` TIMESTAMP NULL AFTER `updated_at`;

CREATE INDEX `idx_diary_report_admin_seen` ON `diary_report` (`admin_seen_at`, `created_at`);
