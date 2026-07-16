INSERT INTO `lookup` (`refCode`, `type`, `title`, `value`, `status`, `lookupOrder`, `lookupCreatedDate`)
SELECT 'answerType', 'answerType', 'Number', 'number', 'enable', 4, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `lookup`
  WHERE `refCode` = 'answerType' AND `value` = 'number'
);
