-- The tasks preload now keeps open rows (completed_at = '') plus recently
-- completed ones, an OR that SQLite can satisfy with two probes of one index
-- on the same column. The existing status index leads with status and cannot
-- serve either branch.
CREATE INDEX IF NOT EXISTS app_elder_care__tasks_completed_at_idx
  ON app_elder_care__tasks (completed_at);
