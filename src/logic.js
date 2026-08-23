// Pure, testable logic extracted from index.html.
// No DOM, no network — safe to import from Node for unit tests.

export const CATEGORIES = [
  { id: "general", label: "General", cls: "info" },
  { id: "health", label: "Health", cls: "warn" },
  { id: "mood", label: "Mood", cls: "mood" },
  { id: "meds", label: "Medication", cls: "good" },
];

export function fmtDate(v) {
  if (!v) return "";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${v}T12:00:00`));
}

export function fmtWhen(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function memberName(memberMap, id) {
  return memberMap.get(id)?.name ?? "Someone";
}

export function catOf(id) {
  return CATEGORIES.find(c => c.id === id) ?? CATEGORIES[0];
}

// The schedule view shows upcoming visits, or falls back to the full list when
// there are none still ahead. `todayStr` is a YYYY-MM-DD string.
export function scheduleList(visits, todayStr) {
  const upcoming = visits.filter(v => v.date >= todayStr);
  return upcoming.length ? upcoming : visits;
}

export function appointmentList(appointments, todayStr) {
  const upcoming = appointments.filter(a => a.date >= todayStr);
  return upcoming.length ? upcoming : appointments;
}

export function openTasks(tasks) {
  return tasks.filter(t => t.status !== "done");
}

export function doneTasks(tasks) {
  return tasks.filter(t => t.status === "done");
}

/**
 * Steady identity for whatever another app derives from one of our rows — in
 * practice a calendar entry made by an automation rule.
 *
 * The triggering event's own id cannot serve: it is fresh on every publish, so
 * it can say "this is a new event" but never "this is the same appointment as
 * last time". A rule keyed on it can only ever insert, which is why removing an
 * appointment used to leave its calendar entry standing forever — nothing named
 * the entry to take it back down.
 *
 * Namespaced by app AND by kind: the key shares one column with every other
 * publisher's, and visits and appointments have independent id spaces of their
 * own, so `elder-care:visit:v1` and `elder-care:appt:v1` must not collide.
 */
export function calendarRef(kind, id) {
  return `elder-care:${kind}:${id}`;
}

/**
 * Fields the in-app search matches against (see hub-sdk `searchMatch`).
 * Category and observer are searchable alongside the note itself, so
 * a care log answers "what did Ada notice about sleep" — the question
 * a running log actually gets asked.
 */
export function searchableFields(item) {
  return [item.note, item.category, item.member_name];
}
