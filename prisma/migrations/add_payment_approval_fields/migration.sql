ALTER TABLE `payment`
  ADD COLUMN `status` VARCHAR(50) NOT NULL DEFAULT 'Approved' AFTER `reference_code`,
  ADD COLUMN `submitted_by` VARCHAR(50) NOT NULL DEFAULT 'admin' AFTER `status`,
  ADD COLUMN `parent_id` INT NULL AFTER `submitted_by`,
  ADD COLUMN `approved_by` INT NULL AFTER `parent_id`,
  ADD COLUMN `approved_at` TIMESTAMP NULL AFTER `approved_by`,
  ADD COLUMN `rejection_reason` VARCHAR(500) NULL AFTER `approved_at`;
