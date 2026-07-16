ALTER TABLE `questionnaire_scoring`
  ADD COLUMN `scoring_interpretation_bm` VARCHAR(255) NULL AFTER `scoring_interpretation`,
  ADD COLUMN `scoring_recommendation_bm` TEXT NULL AFTER `scoring_recommendation`;
