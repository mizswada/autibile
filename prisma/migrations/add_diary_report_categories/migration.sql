ALTER TABLE `diary_report`
  ADD COLUMN `category_1` TEXT NULL AFTER `description`,
  ADD COLUMN `category_2` TEXT NULL AFTER `category_1`,
  ADD COLUMN `category_3` TEXT NULL AFTER `category_2`,
  ADD COLUMN `category_4` TEXT NULL AFTER `category_3`,
  ADD COLUMN `category_5` TEXT NULL AFTER `category_4`;
