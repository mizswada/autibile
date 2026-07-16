-- For DBs that already have category_1..category_5:
-- rename to semantic names and add the 6th category
ALTER TABLE `diary_report`
  CHANGE COLUMN `category_1` `two_way_communication` TEXT NULL,
  CHANGE COLUMN `category_2` `emotional_regulation` TEXT NULL,
  CHANGE COLUMN `category_3` `focus_and_comprehension` TEXT NULL,
  CHANGE COLUMN `category_4` `feeding_and_sensory` TEXT NULL,
  CHANGE COLUMN `category_5` `sleep_and_daily_routines` TEXT NULL,
  ADD COLUMN `socialisation_self_confidence` TEXT NULL AFTER `sleep_and_daily_routines`;
