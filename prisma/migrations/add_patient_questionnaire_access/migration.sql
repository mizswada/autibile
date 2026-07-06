-- Patient questionnaire access: lock/unlock per patient per questionnaire
CREATE TABLE IF NOT EXISTS `patient_questionnaire_access` (
  `access_id` INT NOT NULL AUTO_INCREMENT,
  `patient_id` INT NOT NULL,
  `questionnaire_id` INT NOT NULL,
  `access_status` VARCHAR(50) NOT NULL DEFAULT 'Enable',
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`access_id`),
  UNIQUE KEY `patient_questionnaire_unique` (`patient_id`, `questionnaire_id`),
  KEY `idx_pqa_patient` (`patient_id`),
  KEY `idx_pqa_questionnaire` (`questionnaire_id`),
  CONSTRAINT `pqa_patient_fk` FOREIGN KEY (`patient_id`) REFERENCES `user_patients` (`patient_id`),
  CONSTRAINT `pqa_questionnaire_fk` FOREIGN KEY (`questionnaire_id`) REFERENCES `questionnaires` (`questionnaire_id`)
);

-- Migrate existing M-CHAT-R status from user_patients
INSERT INTO `patient_questionnaire_access` (`patient_id`, `questionnaire_id`, `access_status`)
SELECT `patient_id`, 1, COALESCE(`mchatr_status`, 'Enable')
FROM `user_patients`
WHERE `patient_id` IS NOT NULL
ON DUPLICATE KEY UPDATE `access_status` = VALUES(`access_status`);
