-- The person being cared for. Until now the app had no row for them at all: it
-- recorded who visited and who noticed what, and left "about whom" to be
-- understood. That holds for one parent and stops holding at two.
--
-- `member_id` links the profile to that person's own seat in the hub when they
-- have one, and stays NULL when they do not: a parent who will never open the
-- app still needs a profile. NULL rather than this app's usual '' because the
-- unique index below has to ignore the unlinked rows. The link is kept when that
-- member leaves the hub: the readings they logged for themselves are found by
-- it (see 005), and clearing it would hide them.
--
-- Everything descriptive is free text and encrypted at rest, which the hub
-- decides by column NAME: a `_date`, `_at`, `_id`, `_by` or `_time` suffix
-- stores the value in the clear. Hence `born_on`, not `birth_date`, and
-- `residence`, not `lives_at`. Nothing here needs to compare either in SQL.
--
-- Profiles are archived, never deleted (`archived_at`, '' while active), so a
-- record that names a person always has a person to name.
CREATE TABLE IF NOT EXISTS app_elder_care__profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  member_id TEXT,
  born_on TEXT NOT NULL DEFAULT '',
  residence TEXT NOT NULL DEFAULT '',
  primary_doctor TEXT NOT NULL DEFAULT '',
  pharmacy TEXT NOT NULL DEFAULT '',
  diagnoses TEXT NOT NULL DEFAULT '',
  allergies_note TEXT NOT NULL DEFAULT '',
  diet TEXT NOT NULL DEFAULT '',
  mobility TEXT NOT NULL DEFAULT '',
  cognition TEXT NOT NULL DEFAULT '',
  preferences TEXT NOT NULL DEFAULT '',
  baseline TEXT NOT NULL DEFAULT '',
  archived_at TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- One profile per member. Two profiles claiming the same seat would leave
-- "which profile is this person's own" without an answer.
CREATE UNIQUE INDEX IF NOT EXISTS app_elder_care__profiles_member_uq
  ON app_elder_care__profiles (member_id) WHERE member_id IS NOT NULL;

-- Serves the launch read, which lists profiles in the order they were added.
CREATE INDEX IF NOT EXISTS app_elder_care__profiles_created_at_idx
  ON app_elder_care__profiles (created_at);

-- Who each record is about. '' means nobody in particular: every row written
-- before this migration, a visit or task that is for the whole household, and
-- anything an automation files. Those rows show under every person.
--
-- `profile_id`, not `recipient_id`: across the hub a `recipient_*` column holds
-- member ids, and the member-removal cleanup would treat this one as such.
ALTER TABLE app_elder_care__visits ADD COLUMN profile_id TEXT NOT NULL DEFAULT '';

ALTER TABLE app_elder_care__tasks ADD COLUMN profile_id TEXT NOT NULL DEFAULT '';

ALTER TABLE app_elder_care__appointments ADD COLUMN profile_id TEXT NOT NULL DEFAULT '';

ALTER TABLE app_elder_care__observations ADD COLUMN profile_id TEXT NOT NULL DEFAULT '';
