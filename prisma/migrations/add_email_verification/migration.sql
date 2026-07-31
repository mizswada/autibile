ALTER TABLE `user`
  ADD COLUMN `emailVerified` TINYINT(1) NOT NULL DEFAULT 0 AFTER `signInBy`,
  ADD COLUMN `emailVerifiedAt` DATETIME NULL AFTER `emailVerified`;

CREATE TABLE IF NOT EXISTS `user_email_token` (
  `tokenID` INT NOT NULL AUTO_INCREMENT,
  `userID` INT NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `expiresAt` DATETIME NOT NULL,
  `usedAt` DATETIME NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`tokenID`),
  UNIQUE KEY `user_email_token_token_key` (`token`),
  INDEX `idx_user_email_token_userID` (`userID`),
  INDEX `idx_user_email_token_type` (`type`),
  CONSTRAINT `FK_user_email_token_user` FOREIGN KEY (`userID`) REFERENCES `user` (`userID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE `user`
SET `emailVerified` = 1,
    `emailVerifiedAt` = COALESCE(`userCreatedDate`, NOW())
WHERE `emailVerified` = 0;
