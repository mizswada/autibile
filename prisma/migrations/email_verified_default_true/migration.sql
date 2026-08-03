-- Email verification flow removed: new users are verified by default.
ALTER TABLE `user`
  MODIFY COLUMN `emailVerified` TINYINT(1) NOT NULL DEFAULT 1;

-- Backfill verification timestamp where missing.
UPDATE `user`
SET `emailVerified` = 1,
    `emailVerifiedAt` = COALESCE(`emailVerifiedAt`, `userCreatedDate`, NOW())
WHERE `emailVerified` = 0 OR `emailVerifiedAt` IS NULL;
