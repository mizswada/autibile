ALTER TABLE `appointments`
  ADD COLUMN `start_time` TIME NULL AFTER `slot_ID`,
  ADD COLUMN `end_time` TIME NULL AFTER `start_time`;
