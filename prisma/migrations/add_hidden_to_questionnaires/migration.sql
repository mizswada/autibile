-- AlterTable
ALTER TABLE `questionnaires` ADD COLUMN `hidden` BOOLEAN NOT NULL DEFAULT false;

-- Update M-CHAT-R/F to hidden
UPDATE `questionnaires` SET `hidden` = true WHERE `questionnaire_id` = 2;
