// Pure, testable logic extracted from index.html.
// No DOM, no network — safe to import from Node for unit tests.

export const CATEGORIES = [
  { id: "general", label: "General", cls: "info" },
  { id: "health", label: "Health", cls: "warn" },
  { id: "mood", label: "Mood", cls: "mood" },
  { id: "meds", label: "Medication", cls: "good" },
];

// Both formatters show a value they cannot read exactly as it was stored.
// Formatting an invalid Date throws, and these run inside the template of every
// list, so one bad row would blank the tab it is on and hide the control that
// removes it. A date that rolls over (31 February) is refused for the same
// reason as in fmtBirth: it would display a day nobody entered.
export function fmtDate(v) {
  if (!v) return "";
  if (!isCalendarDate(v)) return String(v);
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${v}T12:00:00`));
}

export function fmtWhen(iso) {
  if (!iso) return "";
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return String(iso);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(when);
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

// ── The people being cared for ────────────────────────────────────────────────
//
// A profile stands for the person a record is ABOUT, which the app never modelled: it
// knew who visited and who noticed something, not which parent. Each record now
// carries a `profile_id`, and '' on it means "nobody in particular" — a row
// written before profiles existed, a visit or task that is for the whole
// household, or a task an automation filed. Those show under every person.

/**
 * The profile form, in display order. `key` is the column name, and the form
 * builds its UPDATE from these keys, so nothing reaches SQL that is not in this
 * list. `long` fields are free-text paragraphs.
 */
export const PROFILE_FIELDS = [
  { key: "born_on", label: "Date of birth", type: "date" },
  { key: "residence", label: "Where they live", placeholder: "At home, with Sam, Maple Court room 12" },
  { key: "primary_doctor", label: "Primary doctor", placeholder: "Name and phone" },
  { key: "pharmacy", label: "Pharmacy", placeholder: "Name and phone" },
  { key: "diagnoses", label: "Conditions and diagnoses", long: true, placeholder: "What they are being treated for" },
  { key: "allergies_note", label: "Allergies", long: true, placeholder: "Medicines, foods, anything else" },
  { key: "diet", label: "Diet", long: true, placeholder: "What they eat, what they must avoid" },
  { key: "mobility", label: "Mobility and daily help", long: true, placeholder: "Walking, stairs, bathing, dressing" },
  { key: "cognition", label: "Memory and thinking", long: true, placeholder: "What is usual for them" },
  { key: "preferences", label: "Preferences and routines", long: true, placeholder: "What matters to them, how the day goes" },
  { key: "baseline", label: "A normal day", long: true, placeholder: "How they usually are, so a change stands out" },
];

/** Every column the profile form may write. */
export const PROFILE_COLUMNS = ["name", "member_id", ...PROFILE_FIELDS.map(f => f.key)];

export function activeProfiles(profiles) {
  return profiles.filter(r => !r.archived_at);
}

export function archivedProfiles(profiles) {
  return profiles.filter(r => !!r.archived_at);
}

/**
 * The profile the lists are narrowed to, or "" for no narrowing.
 *
 * Narrowing only means something with two or more people to tell apart. With
 * one, every record is theirs or the household's, so nothing is hidden and no
 * switcher is drawn. A selection naming someone who has since been archived
 * falls back to everyone, never to an empty screen.
 */
export function viewProfileId(profiles, selectedId) {
  const active = activeProfiles(profiles);
  if (active.length < 2) return "";
  return active.some(r => r.id === selectedId) ? selectedId : "";
}

/**
 * The one person in view: the only active profile, or the selected one.
 * null when several are active and none is selected. The Profile tab shows
 * their profile, and a new log entry or appointment is about them. A visit or
 * a task starts on them only when they were chosen from two or more.
 */
export function profileInView(profiles, selectedId) {
  const active = activeProfiles(profiles);
  if (active.length === 1) return active[0];
  return active.find(r => r.id === selectedId) ?? null;
}

/** Rows for one person: theirs plus the ones that name nobody. */
export function forProfile(rows, viewId) {
  if (!viewId) return rows;
  return rows.filter(r => !r.profile_id || r.profile_id === viewId);
}

/**
 * Whether each row should say who it is about. Only when the list mixes
 * people: nothing is narrowed, and more than one profile exists (an archived
 * one counts, because its records are still in the list).
 */
export function showsProfileTag(profiles, viewId) {
  return !viewId && profiles.length > 1;
}

export function profileName(profiles, id) {
  if (!id) return "";
  return profiles.find(r => r.id === id)?.name ?? "";
}

/**
 * Members a profile may be linked to. A member already linked to another
 * profile is left out, archived profiles included, because the database allows
 * one profile per member. `exceptId` is the profile being edited, whose own
 * link must stay selectable.
 */
export function linkableMembers(members, profiles, exceptId = "") {
  const taken = new Set(profiles.filter(r => r.member_id && r.id !== exceptId).map(r => r.member_id));
  return members.filter(m => !taken.has(m.id));
}

/**
 * Log entries and appointments that name nobody. Unlike a visit or a task,
 * these are always about one person, so an unnamed one is a record from before
 * profiles existed. Counted over the rows loaded so far.
 */
export function untaggedCount(observations, appointments) {
  return observations.filter(o => !o.profile_id).length + appointments.filter(a => !a.profile_id).length;
}

/**
 * Whether a string is a real calendar date written `YYYY-MM-DD`.
 *
 * The shape alone is not enough. `1944-13-09` has the shape and no meaning, and
 * formatting it throws, which took the whole Profile tab down with it and the
 * Edit button that would have fixed the value. `1944-02-31` is worse because it
 * does not throw: the Date constructor rolls it over to 2 March and the card
 * states a birthday nobody entered. The round trip catches both.
 */
export function isCalendarDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  // setUTCFullYear, because Date.UTC reads a year below 100 as 19xx.
  d.setUTCFullYear(year);
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/** Whole years between two `YYYY-MM-DD` dates, or null when either is unusable. */
export function ageOn(bornOn, todayStr) {
  if (!isCalendarDate(bornOn) || !isCalendarDate(todayStr)) return null;
  let age = Number(todayStr.slice(0, 4)) - Number(bornOn.slice(0, 4));
  if (todayStr.slice(5) < bornOn.slice(5)) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}

/**
 * A date of birth for display. A value that is not a real date is shown as it
 * was stored, so whoever reads the card can see what is there and correct it.
 */
export function fmtBirth(bornOn, todayStr) {
  if (!isCalendarDate(bornOn)) return bornOn ?? "";
  const text = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${bornOn}T12:00:00`));
  const age = ageOn(bornOn, todayStr);
  return age === null ? text : `${text} (age ${age})`;
}

/** The filled-in profile fields, in form order, ready to display. */
export function profileEntries(profile, todayStr) {
  return PROFILE_FIELDS
    .filter(f => (profile[f.key] ?? "") !== "")
    .map(f => ({ key: f.key, label: f.label, long: !!f.long, value: f.type === "date" ? fmtBirth(profile[f.key], todayStr) : profile[f.key] }));
}

/**
 * The columns a profile edit actually changed. `before` is what the form
 * showed when it opened and `after` what it holds now.
 *
 * A profile is many independent fields, and two siblings will edit it from
 * copies loaded at different times. Writing the whole row back would let the
 * later save silently restore every field the earlier one had just changed.
 * Writing only what this person touched keeps both edits unless they changed
 * the very same field.
 */
export function profileChanges(before, after) {
  const changed = {};
  for (const key of PROFILE_COLUMNS) {
    const was = before[key] ?? (key === "member_id" ? null : "");
    const now = after[key] ?? (key === "member_id" ? null : "");
    if (was !== now) changed[key] = now;
  }
  return changed;
}
