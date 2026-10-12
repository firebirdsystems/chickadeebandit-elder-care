-- A paid caregiver: someone the family employs who is in the house more than
-- any of them. They sign in as a GUEST of the household, which gives them a
-- name, an end date and no bulk export, and which the hub treats as a member
-- who is not an adult. Until now such a person could read everything here and
-- write nothing. This migration is what they may write, and what they may not
-- read.
--
-- The shift log. Arrived, left, what was done, and what the next person should
-- know. The hub stamps `member_id` with the caller on every insert and nobody
-- can rewrite it afterwards, so a shift is always the shift of whoever logged
-- it. The writer may change their own entry; an adult may change or remove any.
--
-- `started_at` and `ended_at` are instants in UTC, and `ended_at` is '' while
-- the shift is still running. `shift_date` is the HOUSEHOLD's calendar day the
-- shift started on, like `measured_date` on a reading. All three are plaintext
-- by suffix. `summary` and `handoff` are free text and encrypted, and so is
-- `member_name`, kept beside the id because a guest's seat is removed when the
-- job ends and the log should still say who it was.
--
-- `visibility` is the column the row policy reads to let everyone see a row.
-- It is always 'everyone' and the manifest lets nobody write it.
CREATE TABLE IF NOT EXISTS app_elder_care__shifts (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  member_name TEXT NOT NULL DEFAULT '',
  profile_id TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL DEFAULT '',
  shift_date TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  handoff TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'everyone',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Serves the launch read, which lists recent shifts newest first.
CREATE INDEX IF NOT EXISTS app_elder_care__shifts_started_at_idx
  ON app_elder_care__shifts (started_at, id);

-- Family-only log entries. 'everyone' is what every row was before this
-- migration and what a new one is unless its author says otherwise. 'family'
-- is read by the adults of the household and by nobody else: not a guest, and
-- not a child. Only an adult may write the column (manifest column_write_acls).
ALTER TABLE app_elder_care__observations ADD COLUMN visibility TEXT NOT NULL DEFAULT 'everyone';

-- A caregiver records readings into the same table the family does. The hub
-- now stamps `recorded_by` with the caller, lets a person who is not an adult
-- change only the readings they recorded, and lets only adults remove one.
-- This column is the one that policy kind needs: always 'everyone', written by
-- nobody.
ALTER TABLE app_elder_care__vitals ADD COLUMN visibility TEXT NOT NULL DEFAULT 'everyone';

-- The name of whoever recorded the reading, beside their id, for the same
-- reason a shift keeps one: when the job ends the guest's seat goes, and the
-- reading should still say who took it. '' on every reading from before this.
-- Encrypted, as a name is. The id is what the hub stamps and what the policy
-- trusts; this is what the page shows.
ALTER TABLE app_elder_care__vitals ADD COLUMN recorded_by_name TEXT NOT NULL DEFAULT '';

-- A caregiver ticks a task off. Everything else about a task stays with the
-- adults: the manifest lets a person who is not an adult write `status`,
-- `completed_at`, `completed_by` and `completed_by_name`, and no other column.
-- `completed_by` is who the page says ticked it ('' while open, and on every
-- task ticked before this migration) and `completed_by_name` their name, kept
-- so the task still says who once that person's seat is gone. `visibility` is
-- the policy's column again, always 'everyone'.
ALTER TABLE app_elder_care__tasks ADD COLUMN visibility TEXT NOT NULL DEFAULT 'everyone';

ALTER TABLE app_elder_care__tasks ADD COLUMN completed_by TEXT NOT NULL DEFAULT '';

ALTER TABLE app_elder_care__tasks ADD COLUMN completed_by_name TEXT NOT NULL DEFAULT '';
