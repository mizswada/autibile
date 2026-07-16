-- Fresh install: add 6 semantic diary category columns
-- If category_1..category_5 already exist, use rename_diary_report_categories instead
ALTER TABLE `diary_report`
  ADD COLUMN `two_way_communication` TEXT NULL AFTER `description`,
  ADD COLUMN `emotional_regulation` TEXT NULL AFTER `two_way_communication`,
  ADD COLUMN `focus_and_comprehension` TEXT NULL AFTER `emotional_regulation`,
  ADD COLUMN `feeding_and_sensory` TEXT NULL AFTER `focus_and_comprehension`,
  ADD COLUMN `sleep_and_daily_routines` TEXT NULL AFTER `feeding_and_sensory`,
  ADD COLUMN `socialisation_self_confidence` TEXT NULL AFTER `sleep_and_daily_routines`;
