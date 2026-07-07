CREATE TABLE IF NOT EXISTS app_elder_care__visits (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT DEFAULT '',
  member_id TEXT NOT NULL,
  member_name TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_elder_care__tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  detail TEXT DEFAULT '',
  assignee_id TEXT DEFAULT '',
  assignee_name TEXT DEFAULT '',
  due_date TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_by TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS app_elder_care__appointments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  provider TEXT DEFAULT '',
  date TEXT NOT NULL,
  time TEXT DEFAULT '',
  location TEXT DEFAULT '',
  accompanied_by_id TEXT DEFAULT '',
  accompanied_by_name TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_elder_care__observations (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  member_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  note TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS app_elder_care__visits_date_idx ON app_elder_care__visits(date);
CREATE INDEX IF NOT EXISTS app_elder_care__tasks_status_idx ON app_elder_care__tasks(status, due_date);
CREATE INDEX IF NOT EXISTS app_elder_care__appointments_date_idx ON app_elder_care__appointments(date);
CREATE INDEX IF NOT EXISTS app_elder_care__observations_at_idx ON app_elder_care__observations(observed_at);
