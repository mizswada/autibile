-- Extend account_deletion_requests for unified Account Requests (password reset + deletion)
ALTER TABLE `account_deletion_requests`
  ADD COLUMN `request_type` VARCHAR(50) NOT NULL DEFAULT 'AccountDeletion' AFTER `request_id`,
  ADD COLUMN `phone_number` VARCHAR(50) NULL AFTER `email`,
  ADD COLUMN `user_id` INT NULL AFTER `phone_number`;
