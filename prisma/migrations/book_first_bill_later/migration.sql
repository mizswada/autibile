-- Book first, bill later + Zakat patient flag + void invoice + session adjustment log.
-- Run on the live DB BEFORE deploying the code that uses it (take a mysqldump first).
-- Backwards compatible: the currently deployed code ignores the new columns and table.
-- Each statement runs once. If one fails halfway, check SHOW COLUMNS before re-running it.

-- 1. Appointments: which ones were booked without a prepaid session, and which invoice bills them.
--    Existing rows keep the defaults (0 / 0 / NULL) = "covered by a prepaid session".
--    No foreign key on invoice_id on purpose: hard delete removes invoices before appointments.
ALTER TABLE `appointments`
  ADD COLUMN `needs_billing` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `billing_waived` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `invoice_id` INT NULL,
  ADD KEY `idx_appointments_invoice_id` (`invoice_id`),
  ADD KEY `idx_appointments_needs_billing` (`needs_billing`, `invoice_id`);

-- 2. Zakat patient flag (new invoices default their Zakat label from it).
ALTER TABLE `user_patients` ADD COLUMN `is_zakat` TINYINT(1) NOT NULL DEFAULT 0;

-- 3. Void invoice (invoice.status is a free VARCHAR, so the new 'Void' value needs no change).
ALTER TABLE `invoice`
  ADD COLUMN `voided_at` TIMESTAMP NULL,
  ADD COLUMN `void_reason` VARCHAR(500) NULL;

-- 4. Log of every manual session adjustment. No foreign keys (same reason as user_deletion_audit).
CREATE TABLE IF NOT EXISTS `session_adjustment` (
  `adjustment_id`  INT          NOT NULL AUTO_INCREMENT,
  `patient_id`     INT          NOT NULL,
  `delta`          INT          NOT NULL,
  `balance_before` INT          NOT NULL,
  `balance_after`  INT          NOT NULL,
  `reason`         VARCHAR(500) NOT NULL,
  `admin_user_id`  INT          NOT NULL,
  `admin_email`    VARCHAR(255) NULL,
  `ip`             VARCHAR(64)  NULL,
  `created_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`adjustment_id`),
  KEY `patient_id` (`patient_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
