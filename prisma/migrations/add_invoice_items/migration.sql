-- Multi-item invoices + Zakat "pay later".
-- Run on the live DB BEFORE deploying the code that uses it (take a mysqldump first).
-- Backwards compatible: the currently deployed code keeps working after this runs.

-- If your client refuses UPDATEs without a key in WHERE (MySQL Workbench "safe updates"):
SET SQL_SAFE_UPDATES = 0;

-- 1. Line items of an invoice (therapy package / product / other).
CREATE TABLE IF NOT EXISTS `invoice_item` (
  `item_id`     INT           NOT NULL AUTO_INCREMENT,
  `invoice_id`  INT           NOT NULL,
  `item_type`   VARCHAR(20)   NOT NULL,
  `package_id`  INT           NULL,
  `product_id`  INT           NULL,
  `name`        VARCHAR(255)  NOT NULL,
  `description` VARCHAR(500)  NULL,
  `qty`         INT           NOT NULL DEFAULT 1,
  `unit_price`  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `subtotal`    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `sessions`    INT           NOT NULL DEFAULT 0,
  `created_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`item_id`),
  KEY `invoice_id` (`invoice_id`),
  CONSTRAINT `invoice_item_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `invoice` (`invoice_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Pay-later flag and "sessions already credited" flag on the invoice.
ALTER TABLE `invoice`
  ADD COLUMN `pay_later` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `sessions_credited` TINYINT(1) NOT NULL DEFAULT 0;

-- 3. Every invoice that is already Paid had its sessions credited at payment time.
--    Mark them so they can never be credited a second time.
--    (Safe to run again right after the deploy; see the rollout notes.)
UPDATE `invoice` SET `sessions_credited` = 1 WHERE `status` = 'Paid' AND `sessions_credited` = 0;

-- 4. Allow cents (product prices have 2 decimals). Lossless widening.
ALTER TABLE `invoice` MODIFY COLUMN `amount` DECIMAL(10,2) NULL;
ALTER TABLE `payment` MODIFY COLUMN `amount` DECIMAL(10,2) NULL;
