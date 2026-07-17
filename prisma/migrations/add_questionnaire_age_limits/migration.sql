-- Age limit fields for autism screenings (stored as total months)
ALTER TABLE `questionnaires`
  ADD COLUMN `min_age_months` INT NULL,
  ADD COLUMN `max_age_months` INT NULL,
  ADD COLUMN `age_warning_enabled` BOOLEAN NOT NULL DEFAULT true;

-- M-CHAT-R validated range: 18–30 months (hard lock when outside range)
UPDATE `questionnaires`
SET `min_age_months` = 18,
    `max_age_months` = 30,
    `age_warning_enabled` = false
WHERE `questionnaire_id` = 1;
