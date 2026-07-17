-- Configurable age warning message shown in the app when a child is outside the age range
ALTER TABLE `questionnaires`
  ADD COLUMN `age_warning_message` TEXT NULL AFTER `age_warning_enabled`;
