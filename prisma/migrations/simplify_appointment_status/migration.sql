-- Appointment statuses are reduced to Booked (36), Cancelled (37) and Completed (41).
-- 38 Started / 39 Confirmed Start -> Booked, 40 Finished -> Completed.
-- Run on the live DB (take a mysqldump first). The deployed code works before and after this runs.

SET SQL_SAFE_UPDATES = 0;

-- Keep the old values so this can be undone.
CREATE TABLE IF NOT EXISTS `appointments_status_backup` AS
  SELECT `appointment_id`, `status` FROM `appointments` WHERE `status` IN (38, 39, 40);

UPDATE `appointments` SET `status` = 36 WHERE `status` IN (38, 39);
UPDATE `appointments` SET `status` = 41 WHERE `status` = 40;

-- To undo:
--   UPDATE `appointments` a JOIN `appointments_status_backup` b ON b.appointment_id = a.appointment_id
--   SET a.status = b.status;
