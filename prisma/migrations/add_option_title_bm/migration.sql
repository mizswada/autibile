-- Bilingual answer options: Malay translation (mirrors question_text_bm pattern)
ALTER TABLE `questionnaires_questions_action`
  ADD COLUMN `option_title_bm` VARCHAR(255) NULL AFTER `option_title`;
