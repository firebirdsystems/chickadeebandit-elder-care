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
