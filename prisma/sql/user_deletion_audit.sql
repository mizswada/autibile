-- Audit trail for admin "hard delete user" actions.
-- No foreign keys on purpose: the deleted user can no longer be referenced.
CREATE TABLE IF NOT EXISTS `user_deletion_audit` (
  `audit_id` INT NOT NULL AUTO_INCREMENT,
  `deleted_user_id` INT NOT NULL,
  `deleted_user_name` VARCHAR(255) NULL,
  `deleted_user_email` VARCHAR(255) NULL,
  `deleted_roles` VARCHAR(255) NULL,
  `admin_user_id` INT NOT NULL,
  `admin_email` VARCHAR(255) NULL,
  `ip` VARCHAR(64) NULL,
  `counts` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_id`),
  KEY `idx_user_deletion_audit_deleted_user` (`deleted_user_id`),
  KEY `idx_user_deletion_audit_admin` (`admin_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
