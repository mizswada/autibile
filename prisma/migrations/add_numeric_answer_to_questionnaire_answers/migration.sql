-- Store the user's numeric response separately from scoring points.
ALTER TABLE `questionnaires_questions_answers`
  ADD COLUMN `numeric_answer` INT NULL AFTER `text_answer`;

-- Backfill historical number/range answers that were stored only in score.
UPDATE `questionnaires_questions_answers`
SET `numeric_answer` = `score`
WHERE `option_id` IS NULL
  AND (`text_answer` IS NULL OR TRIM(`text_answer`) = '')
  AND `score` IS NOT NULL;
