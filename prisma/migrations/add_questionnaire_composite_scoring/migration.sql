-- Adds an optional, fully configurable composite scoring recipe (JSON) per questionnaire.
-- When NULL, scoring behaves exactly as before (flat sum of answer scores).
ALTER TABLE `questionnaires`
  ADD COLUMN `composite_scoring_config` TEXT NULL AFTER `hidden`;
