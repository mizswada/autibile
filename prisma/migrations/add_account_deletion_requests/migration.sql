CREATE TABLE IF NOT EXISTS `account_deletion_requests` (
  `request_id` INT NOT NULL AUTO_INCREMENT,
  `full_name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `account_type` VARCHAR(50) NOT NULL,
  `additional_info` TEXT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Pending',
  `admin_notes` TEXT NULL,
  `processed_by` INT NULL,
  `processed_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL,
  PRIMARY KEY (`request_id`),
  INDEX `idx_account_deletion_requests_status` (`status`),
  INDEX `idx_account_deletion_requests_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
