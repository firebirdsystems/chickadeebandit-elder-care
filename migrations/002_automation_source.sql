-- Automations file a care task when another app records something the care
-- circle has to act on (manifest.automation_actions.add_task).
--
-- `source_event_id` records which app event produced the row. The dispatcher's
-- dedupe guard reads it before running the action (SELECT 1 ... WHERE
-- source_event_id = ? LIMIT 1), so one event never files the same task twice —
-- not on a retry, and not from two rules watching the same trigger.
--
-- Nullable on purpose: tasks an adult adds in the app leave it NULL.
ALTER TABLE app_elder_care__tasks ADD COLUMN source_event_id TEXT;

CREATE INDEX IF NOT EXISTS app_elder_care__tasks_source_event_idx
  ON app_elder_care__tasks (source_event_id);
