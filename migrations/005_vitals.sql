-- Readings taken for a person: blood pressure, weight, blood sugar and the rest.
-- The observation log already holds "seemed tired"; this holds the numbers a
-- doctor asks for, in a shape that can be charted and handed over.
--
-- Two tables, because two different people may write a reading and the hub has
-- to be able to tell them apart without trusting the page:
--
--   vitals      an adult recorded it, for any profile. Only adults may write.
--   own_vitals  a person recorded it for THEMSELVES. The hub stamps `member_id`
--               with the caller on every insert, lets nobody else change the
--               row, and lets nobody at all rewrite `member_id` afterwards
--               (manifest column_write_acls), so it can only ever belong to
--               the profile linked to that member. This is how a parent who is not an adult in the hub
--               logs their own readings, and why it has no `profile_id`: a
--               column the writer fills in could name anyone.
--
-- `value` and `value2` are TEXT on purpose. The hub decides what to encrypt by
-- column name and type, and a numeric column is never encrypted, so a REAL here
-- would keep every reading in the clear beside an encrypted diagnosis. Nothing
-- compares or sorts them in SQL: the page parses them and draws the trend.
-- `value2` is the second number of a blood pressure reading and '' otherwise.
--
-- `measured_at` is the instant, in UTC. `measured_date` is the HOUSEHOLD's
-- calendar day that instant fell on, like every other stored date in the app,
-- and it is what a report's From and To are compared with: 6 pm on the 31st in Los Angeles is already the 1st in UTC,
-- and a record "to the 31st" filtered on the instant would leave that reading
-- out. '' only on a row written without it, where the UTC date stands in.
--
-- `kind` is a fixed word from the app's own list and is declared plaintext in
-- the manifest, so it can be filtered and grouped. `unit` is stored with the
-- reading because a family can weigh in pounds one month and kilograms the next.
CREATE TABLE IF NOT EXISTS app_elder_care__vitals (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  value2 TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  measured_at TEXT NOT NULL,
  measured_date TEXT NOT NULL DEFAULT '',
  recorded_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Serves both reads the Vitals tab makes: the recent window when it opens, and
-- earlier readings a page at a time, walked by (measured_at, id). The page read
-- is written `measured_at <= ? AND (measured_at < ? OR id < ?)` so the planner
-- can seek to the cursor; the plain OR form scans from the newest row each time.
CREATE INDEX IF NOT EXISTS app_elder_care__vitals_measured_at_idx
  ON app_elder_care__vitals (measured_at, id);

-- `visibility` is the column the row policy reads to let everyone see a row. It
-- is always 'everyone' and the manifest lets nobody write it.
CREATE TABLE IF NOT EXISTS app_elder_care__own_vitals (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  value2 TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  measured_at TEXT NOT NULL,
  measured_date TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'everyone',
  created_at TEXT NOT NULL
);

-- Led by member_id: the page reads only the rows of members who have a profile.
CREATE INDEX IF NOT EXISTS app_elder_care__own_vitals_member_idx
  ON app_elder_care__own_vitals (member_id, measured_at, id);

-- The same household calendar day for a log entry, for the same reason. Entries written
-- before this column exist with '', and the report falls back to their UTC date.
ALTER TABLE app_elder_care__observations ADD COLUMN observed_date TEXT NOT NULL DEFAULT '';
