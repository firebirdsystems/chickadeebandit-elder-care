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
  // The year only when it is not this one. Without it, a reading from last
  // October and one from this October read the same in a long history.
  const year = when.getFullYear() === new Date().getFullYear() ? undefined : "numeric";
  return new Intl.DateTimeFormat(undefined, { year, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(when);
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

// ── Vitals ────────────────────────────────────────────────────────────────────
//
// A reading is a number (two, for blood pressure) taken for one person at one
// moment. It is stored as text so the hub encrypts it, and parsed back here.

/**
 * What can be recorded. `ranges` maps each unit to the values the form accepts:
 * wide enough for a very ill person, narrow enough to catch a slipped decimal
 * or a weight typed into the pulse field. Where a kind has two units the two
 * ranges are the same span to within half a percent, so the same reading is not
 * accepted in one and refused in the other. The first unit is the default.
 * `whole` kinds are scales, which take no decimals.
 */
export const VITAL_KINDS = [
  { id: "bp", label: "Blood pressure", ranges: { "mmHg": [40, 300] }, range2: [20, 200], labels: ["Top number", "Bottom number"] },
  { id: "pulse", label: "Pulse", ranges: { "bpm": [20, 250] } },
  { id: "weight", label: "Weight", ranges: { "lb": [40, 700], "kg": [18.1, 318] } },
  { id: "glucose", label: "Blood sugar", ranges: { "mg/dL": [20, 800], "mmol/L": [1.1, 44.4] } },
  { id: "temp", label: "Temperature", ranges: { "°F": [85, 110], "°C": [29.4, 43.3] } },
  { id: "oxygen", label: "Oxygen", ranges: { "%": [50, 100] } },
  { id: "sleep", label: "Sleep", ranges: { "hours": [0, 24] } },
  { id: "appetite", label: "Appetite", ranges: { "of 5": [1, 5] }, whole: true, hint: "1 is barely ate, 5 is ate well" },
  { id: "pain", label: "Pain", ranges: { "of 10": [0, 10] }, whole: true, hint: "0 is none, 10 is the worst" },
];

export function vitalKind(id) {
  return VITAL_KINDS.find(k => k.id === id) ?? null;
}

export function vitalUnits(kind) {
  return Object.keys(kind.ranges);
}

/**
 * Who may record a reading for a profile: any adult, and the person the profile
 * is linked to. The hub enforces both, through two tables. An adult writes
 * `vitals`, which only adults may write. Anyone else writes `own_vitals`, where
 * the hub stamps the row with the caller, so it can only count toward the
 * caller's own profile (see vitalsFor).
 */
export function canLogVitals(member, profile, adult) {
  if (!member || !profile || profile.archived_at) return false;
  return !!adult || (!!profile.member_id && profile.member_id === member.id);
}

/**
 * A row of `own_vitals` in the shape the rest of the page uses. `own` routes a
 * delete to the right table and `recorded_by` is who the hub says wrote it.
 */
export function ownReading(row) {
  return { ...row, own: true, recorded_by: row.member_id };
}

/**
 * Who may remove a reading, mirroring the hub. One a person logged for
 * themselves: that person only. One an adult recorded: any adult.
 */
export function canDeleteReading(member, reading, adult) {
  if (!member || !reading) return false;
  return reading.own ? (!!member.id && reading.member_id === member.id) : !!adult;
}

/** A typed number, with a comma accepted as the decimal mark. NaN when it is not one. */
function typedNumber(raw) {
  const text = String(raw ?? "").trim().replace(",", ".");
  return /^(\d+\.?\d*|\.\d+)$/.test(text) ? Number(text) : NaN;
}

/**
 * Checks what was typed for a reading. Returns the values as the text to store,
 * or the sentence to show the person.
 */
export function parseReading(kindId, unit, raw, raw2 = "") {
  const kind = vitalKind(kindId);
  if (!kind) return { ok: false, error: "Choose what you measured." };
  const range = kind.ranges[unit];
  if (!range) return { ok: false, error: "Choose a unit." };
  const check = (text, [min, max], label) => {
    const n = typedNumber(text);
    if (Number.isNaN(n)) return `${label} must be a number.`;
    if (kind.whole && !Number.isInteger(n)) return `${label} must be a whole number.`;
    if (n < min || n > max) return `${label} must be between ${min} and ${max}${kind.whole ? "" : ` ${unit}`}.`;
    return n;
  };
  const first = check(raw, range, kind.labels?.[0] ?? kind.label);
  if (typeof first === "string") return { ok: false, error: first };
  // Two decimals is finer than any of these is measured, and rounding keeps the
  // stored text a plain decimal: String(0.0000001) is "1e-7", which reads back
  // as not a number.
  const stored = n => String(Math.round(n * 100) / 100);
  if (!kind.range2) return { ok: true, value: stored(first), value2: "" };
  const second = check(raw2, kind.range2, kind.labels[1]);
  if (typeof second === "string") return { ok: false, error: second };
  // The commonest slip with a cuff is entering the two numbers the wrong way
  // round. Compared as stored, so two values that round to the same number
  // cannot be saved as an equal pair.
  if (Number(stored(second)) >= Number(stored(first))) return { ok: false, error: "The top number must be higher than the bottom number." };
  return { ok: true, value: stored(first), value2: stored(second) };
}

/** A stored value as a number, or NaN. Stored text is not trusted to be numeric. */
export function readingNumber(text) {
  return typedNumber(text);
}

/** "128/82 mmHg", "98.6 °F", "3 of 5". A value that is not a number is shown as stored. */
export function fmtReading(reading) {
  const show = text => { const n = typedNumber(text); return Number.isNaN(n) ? String(text ?? "") : String(n); };
  const numbers = reading.value2 ? `${show(reading.value)}/${show(reading.value2)}` : show(reading.value);
  return reading.unit ? `${numbers} ${reading.unit}` : numbers;
}

/**
 * One person's readings: those adults recorded against their profile, plus the
 * ones the member linked to the profile logged for themselves.
 *
 * A self-logged row is matched on the member the hub stamped it with, never on
 * anything its writer chose. So a row some other member wrote is on nobody's
 * chart unless that member has a profile of their own.
 */
export function vitalsFor(vitals, profile) {
  return vitals.filter(v => (v.own
    ? !!profile.member_id && v.member_id === profile.member_id
    : v.profile_id === profile.id));
}

/** Readings grouped by kind, each group newest first. Unknown kinds are dropped. */
export function readingsByKind(vitals) {
  const groups = new Map();
  for (const v of vitals) {
    if (!vitalKind(v.kind)) continue;
    if (!groups.has(v.kind)) groups.set(v.kind, []);
    groups.get(v.kind).push(v);
  }
  // created_at breaks a tie, so of two readings given the same time the one
  // entered later is the latest, on this screen and after a reload alike.
  for (const list of groups.values()) {
    list.sort((a, b) => String(b.measured_at).localeCompare(String(a.measured_at)) || String(b.created_at).localeCompare(String(a.created_at)));
  }
  return groups;
}

/** The unit to offer first: the one this person's latest reading used. */
export function defaultUnit(kind, readingsNewestFirst) {
  const last = readingsNewestFirst.find(r => kind.ranges[r.unit]);
  return last ? last.unit : vitalUnits(kind)[0];
}

const UNIT_FACTORS = {
  "lb>kg": v => v * 0.45359237, "kg>lb": v => v / 0.45359237,
  "°F>°C": v => (v - 32) * 5 / 9, "°C>°F": v => v * 9 / 5 + 32,
  "mg/dL>mmol/L": v => v / 18.016, "mmol/L>mg/dL": v => v * 18.016,
};

/** NaN when there is no conversion, so a reading in a unit we do not know is left off a chart. */
export function convertUnit(value, from, to) {
  if (from === to) return value;
  const convert = UNIT_FACTORS[`${from}>${to}`];
  return convert ? convert(value) : NaN;
}

/**
 * Points for a trend, oldest first, all in the unit of the newest reading so a
 * switch from pounds to kilograms does not draw a cliff. Readings before
 * `sinceMs`, with an unreadable time, or with a value that is not a number are
 * left out.
 */
export function trendSeries(readings, sinceMs = -Infinity) {
  const usable = readings
    .map(r => ({ r, t: Date.parse(r.measured_at) }))
    .filter(p => Number.isFinite(p.t) && p.t >= sinceMs)
    .sort((a, b) => a.t - b.t);
  if (!usable.length) return [];
  const unit = usable[usable.length - 1].r.unit;
  return usable
    .map(({ r, t }) => ({
      t,
      v: convertUnit(typedNumber(r.value), r.unit, unit),
      v2: r.value2 ? convertUnit(typedNumber(r.value2), r.unit, unit) : null,
    }))
    .filter(p => Number.isFinite(p.v) && (p.v2 === null || Number.isFinite(p.v2)));
}

/**
 * A trend as SVG polyline points. null with fewer than two points, where there
 * is no trend to draw. A flat series sits on the middle line.
 */
export function sparkline(series, width = 120, height = 32, pad = 3) {
  if (series.length < 2) return null;
  const t0 = series[0].t, t1 = series[series.length - 1].t;
  const values = series.flatMap(p => (p.v2 === null ? [p.v] : [p.v, p.v2]));
  const lo = Math.min(...values), hi = Math.max(...values);
  const x = t => (t1 === t0 ? width / 2 : pad + ((t - t0) / (t1 - t0)) * (width - 2 * pad));
  const y = v => (hi === lo ? height / 2 : height - pad - ((v - lo) / (hi - lo)) * (height - 2 * pad));
  const round = n => Math.round(n * 10) / 10;
  const line = key => series.map(p => `${round(x(p.t))},${round(y(p[key]))}`).join(" ");
  return { width, height, line: line("v"), line2: series.every(p => p.v2 !== null) ? line("v2") : "" };
}

/** A Date as the `YYYY-MM-DDTHH:MM` a datetime-local input holds, in device time. */
export function toLocalInput(date) {
  const two = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}`;
}

/**
 * The moment a datetime-local value names, as an ISO string, or null when it is
 * not a time, lies in the future, or is before 1900. A reading cannot have been taken tomorrow,
 * and a future one would sit at the top of the list as the "latest" for days.
 * A minute of grace covers a clock that is slightly ahead.
 */
export function localInputToIso(value, nowMs) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value ?? "")) return null;
  if (!isCalendarDate(value.slice(0, 10))) return null;
  const ms = new Date(value).getTime();
  // 1900 is before anyone alive was born; a year typed as "26" lands in year 26.
  if (!Number.isFinite(ms) || ms > nowMs + 60_000 || ms < Date.UTC(1900, 0, 1)) return null;
  return new Date(ms).toISOString();
}

/**
 * Earlier readings are read a page at a time, walked by (measured_at, id): the
 * time alone cannot say where a page ended when several readings share it, and
 * a cursor that cannot move past a shared time reads the same page forever.
 * This one is later than any reading: the place to start.
 */
export const VITALS_CURSOR_START = { at: "9999", id: "" };

/**
 * Where the next page starts: the last row, in (measured_at, id) order, that
 * the HUB has returned so far for that table.
 *
 * Only rows a read returned may move it. A reading the person has just logged
 * with a date ten months back is on screen too, and a cursor taken from the
 * screen would jump to that date: every reading between it and the recent
 * window would never be asked for, and the history would be declared complete.
 */
export function nextVitalsCursor(cursor, rowsFromHub) {
  let next = cursor;
  for (const v of rowsFromHub) {
    const at = v.measured_at ?? "", id = v.id ?? "";
    if (at < next.at || (at === next.at && id < next.id)) next = { at, id };
  }
  return next;
}

/**
 * Adds a page of earlier readings to the ones already loaded. A page can hold a
 * reading that is already here (one logged on this screen with an old date);
 * it is dropped. `done` is true only when the page came back short, which is
 * the one thing that proves there is nothing earlier.
 */
export function mergeOlderVitals(vitals, page, pageSize) {
  const key = v => `${v.own ? "own" : "adult"}:${v.id}`;
  const have = new Set(vitals.map(key));
  return { vitals: [...vitals, ...page.filter(v => !have.has(key(v)))], done: page.length < pageSize };
}

/**
 * Runs one async read at a time, in a way a reset can cancel.
 *
 * A reset means "what is in flight was asked under assumptions that no longer
 * hold" (the Vitals tab resets when a profile's member link changes, because
 * the read was scoped to the members linked at the time). Clearing the cache is
 * not enough: the old read is still coming, and if its result is applied it
 * refills the cache with the old answer and marks it loaded, so the next visit
 * skips the read that would have fetched the right rows. After a reset the old
 * read's result and its failure are both dropped, and it no longer counts as
 * busy.
 */
export function createResettableLoad() {
  let generation = 0;
  let promise = null;
  return {
    get busy() { return promise !== null; },
    get promise() { return promise; },
    /** `apply` and `fail` run only if no reset has happened since this call. */
    start(read, apply, fail) {
      const mine = generation;
      const started = Promise.resolve().then(read).then(
        value => { if (mine === generation) apply(value); },
        error => { if (mine === generation) fail(error); },
      ).finally(() => { if (promise === started) promise = null; });
      promise = started;
      return started;
    },
    reset() { generation += 1; promise = null; },
  };
}

// ── The record for a doctor visit ─────────────────────────────────────────────
//
// The hub renders the documents (manifest `reports`). The page only chooses the
// dates and opens them.

/**
 * The dates the record covers until someone picks their own: the 90 days up to
 * `todayStr`, which the page passes as the HOUSEHOLD's today.
 *
 * Every date the record is compared with is the household's calendar day: an
 * appointment's date, and the day stored on each reading and log entry. A range
 * built from the device's own clock would disagree with them for a member in
 * another timezone, and leave out an entry they logged a moment ago. Worked out
 * on the calendar, not from a clock, so it means the same on any machine.
 */
export function defaultRecordRange(todayStr) {
  if (!isCalendarDate(todayStr)) return { from: "", to: "" };
  const start = new Date(Date.UTC(Number(todayStr.slice(0, 4)), Number(todayStr.slice(5, 7)) - 1, Number(todayStr.slice(8, 10)) - 90));
  return { from: start.toISOString().slice(0, 10), to: todayStr };
}

/**
 * Why a chosen range cannot be opened, or "" when it can. The hub refuses these
 * too, but it would say so in a new tab the person then has to close.
 */
export function recordRangeError(from, to) {
  for (const [label, value] of [["From", from], ["To", to]]) {
    if (value && !isCalendarDate(value)) return `${label} is not a date.`;
  }
  if (from && to && from > to) return "From must not be later than To.";
  return "";
}

/** The address of one document. An empty bound is left off, which the hub reads as open-ended. */
export function recordUrl(reportsUrl, id, format, from, to, base) {
  const url = new URL(`${reportsUrl}/${encodeURIComponent(id)}`, base);
  url.searchParams.set("format", format);
  if (from) url.searchParams.set("from", from);
  if (to) url.searchParams.set("to", to);
  return url.toString();
}

/**
 * Runs a read whose result will REPLACE what is on screen, and returns it only
 * if nothing was written while it was out.
 *
 * A read that overlaps a write may or may not include that write, and there is
 * no telling which from the rows. Replacing the lists with it can take a note
 * someone just saved back off the screen, or put a deleted one back, until the
 * next reload. So an overlapped read is thrown away and made again, when the
 * write it raced has landed. `version` must change when a write starts and
 * again when it ends: the first catches a write that began after the read did,
 * the second a read that began in the middle of one.
 *
 * Gives up after `tries` rather than read for ever against constant writing.
 */
export async function readWhenQuiet(read, version, tries = 4) {
  for (let attempt = 0; attempt < tries; attempt++) {
    const before = version();
    const value = await read();
    if (version() === before) return value;
  }
  throw new Error("The records kept changing while they were being read. Try again.");
}

/**
 * Reads a whole table a page at a time, walking its primary key.
 *
 * The hub refuses an answer over 5,000 rows or 2 MiB, so a table that grows
 * with use cannot be read in one request for ever: past the limit every attempt
 * fails the same way and the history is unreachable. `readPage(after)` returns
 * the next rows with an id above `after`, in id order, at most `pageSize` of
 * them. A short page is the end.
 *
 * The id is used because it is unique and never encrypted, so the walk cannot
 * stall on rows that share a value and needs no knowledge of how each table is
 * displayed. The caller sorts the result.
 */
export async function readAllPages(readPage, pageSize, maxPages = 1000) {
  const rows = [];
  let after = "";
  for (let page = 0; page < maxPages; page++) {
    const batch = await readPage(after);
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
    const last = String(batch[batch.length - 1].id ?? "");
    // A full page that does not move the cursor would be asked for again for ever.
    if (!(last > after)) throw new Error("The history could not be read in order.");
    after = last;
  }
  throw new Error("The history is too long to load at once.");
}

const text = v => String(v ?? "");
const byId = (a, b) => text(a.id).localeCompare(text(b.id));

/** Visits and appointments as their lists show them: by date, then time. */
export function sortByDateTime(rows) {
  return [...rows].sort((a, b) => text(a.date).localeCompare(text(b.date)) || text(a.time).localeCompare(text(b.time)) || byId(a, b));
}

/** Tasks as the list shows them: open before done, dated before undated, soonest due first, then newest. */
export function sortTasks(rows) {
  const done = t => (t.status === "done" ? 1 : 0);
  const undated = t => (text(t.due_date) === "" ? 1 : 0);
  return [...rows].sort((a, b) => done(a) - done(b) || undated(a) - undated(b)
    || text(a.due_date).localeCompare(text(b.due_date)) || text(b.created_at).localeCompare(text(a.created_at)) || byId(a, b));
}

/** Log entries newest first. */
export function sortObservations(rows) {
  return [...rows].sort((a, b) => text(b.observed_at).localeCompare(text(a.observed_at)) || byId(a, b));
}
