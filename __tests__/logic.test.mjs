import { describe, it, expect } from "vitest";
import {
  CATEGORIES, fmtDate, fmtWhen, memberName, catOf,
  scheduleList, appointmentList, openTasks, doneTasks, searchableFields, calendarRef,
  PROFILE_FIELDS, PROFILE_COLUMNS, activeProfiles, archivedProfiles, viewProfileId,
  profileInView, forProfile, showsProfileTag, profileName, linkableMembers,
  untaggedCount, isCalendarDate, ageOn, fmtBirth, profileEntries, profileChanges,
  VITAL_KINDS, vitalKind, vitalUnits, canLogVitals, parseReading, readingNumber, fmtReading,
  vitalsFor, readingsByKind, defaultUnit, convertUnit, trendSeries, sparkline, toLocalInput, localInputToIso,
  VITALS_CURSOR_START, nextVitalsCursor, mergeOlderVitals, ownReading, canDeleteReading,
  createResettableLoad, readWhenQuiet, readAllPages, sortByDateTime, sortTasks, sortObservations, defaultRecordRange, recordRangeError, recordUrl,
  isGuest, helpsHandsOn, logsOwnReading, sortShifts, runningShift, canEditShift, shiftLength, shiftTimesError, latestHandoff,
  NOTE_AUDIENCES, isFamilyOnly, canEditReading, shiftChanges, SHIFT_FORM_FIELDS, fieldConflicts, mergeNote, nextRevision,
  withStoredRow, failureLine,
} from "../src/logic.js";

describe("fmtDate / fmtWhen", () => {
  it("return empty for falsy", () => {
    expect(fmtDate("")).toBe("");
    expect(fmtWhen("")).toBe("");
  });
  it("format non-empty values", () => {
    expect(fmtDate("2026-07-08")).toMatch(/Jul/);
    expect(fmtWhen("2026-07-08T15:30:00Z")).toMatch(/Jul/);
  });
});

describe("fmtDate / fmtWhen on a value that is not a date", () => {
  // These run inside every list's template. A throw there blanks the whole tab,
  // including the Remove button for the row that caused it.
  it("show the stored text instead of throwing", () => {
    for (const bad of ["2026-13-09", "2026-00-10", "next Tuesday", "2026-7-8"]) {
      expect(() => fmtDate(bad)).not.toThrow();
      expect(fmtDate(bad)).toBe(bad);
    }
    for (const bad of ["not a time", "2026-13-09T10:00:00Z", "T10:00"]) {
      expect(() => fmtWhen(bad)).not.toThrow();
      expect(fmtWhen(bad)).toBe(bad);
    }
  });

  it("never roll a date over into a different day", () => {
    expect(fmtDate("2026-02-31")).toBe("2026-02-31");
  });

  it("still format a date-only value passed to fmtWhen", () => {
    expect(fmtWhen("2026-07-08")).toMatch(/Jul/);
  });
});

describe("fmtWhen across years", () => {
  it("shows the year only when it is not the current one", () => {
    const thisYear = new Date().getFullYear();
    expect(fmtWhen(`${thisYear}-07-08T15:30:00Z`)).not.toMatch(String(thisYear));
    expect(fmtWhen(`${thisYear - 1}-07-08T15:30:00Z`)).toMatch(String(thisYear - 1));
  });
});

describe("memberName", () => {
  const map = new Map([["m1", { name: "Alex" }]]);
  it("resolves and defaults to Someone", () => {
    expect(memberName(map, "m1")).toBe("Alex");
    expect(memberName(map, "zz")).toBe("Someone");
  });
});

describe("catOf", () => {
  it("resolves a known category", () => expect(catOf("mood").label).toBe("Mood"));
  it("defaults to the first category", () => expect(catOf("nope")).toBe(CATEGORIES[0]));
});

describe("scheduleList / appointmentList", () => {
  const visits = [
    { id: "past", date: "2026-01-01" },
    { id: "future", date: "2026-12-31" },
  ];
  it("shows only upcoming when some exist", () => {
    expect(scheduleList(visits, "2026-06-01").map(v => v.id)).toEqual(["future"]);
    expect(appointmentList(visits, "2026-06-01").map(v => v.id)).toEqual(["future"]);
  });
  it("falls back to the full list when none upcoming", () => {
    expect(scheduleList(visits, "2027-01-01").map(v => v.id)).toEqual(["past", "future"]);
  });
});

describe("openTasks / doneTasks", () => {
  const tasks = [{ id: "1", status: "open" }, { id: "2", status: "done" }, { id: "3", status: "in_progress" }];
  it("splits by done status", () => {
    expect(openTasks(tasks).map(t => t.id)).toEqual(["1", "3"]);
    expect(doneTasks(tasks).map(t => t.id)).toEqual(["2"]);
  });
});

describe("searchableFields", () => {
  it("matches on the note body and who observed it", () => {
    const fields = searchableFields({ note: "dizzy standing up after lunch", category: "health", member_name: "Ada" });
    expect(fields).toContain("dizzy standing up after lunch");
    expect(fields).toContain("Ada");
    expect(fields).toContain("health");
  });
});

describe("calendarRef", () => {
  it("namespaces by app and by kind", () => {
    // The key shares one column with every other publisher's, and visits and
    // appointments have independent id spaces — `v1` can exist in both.
    expect(calendarRef("appt", "a1")).toBe("elder-care:appt:a1");
    expect(calendarRef("visit", "a1")).toBe("elder-care:visit:a1");
    expect(calendarRef("appt", "x")).not.toBe(calendarRef("visit", "x"));
  });

  it("is stable for the same row, so an announcement and its retraction agree", () => {
    expect(calendarRef("appt", "a1")).toBe(calendarRef("appt", "a1"));
  });
});

// ── The people being cared for ────────────────────────────────────────────────

const mom = { id: "p-mom", name: "Mom", member_id: "m-mom", archived_at: "" };
const dad = { id: "p-dad", name: "Dad", member_id: null, archived_at: "" };
const gran = { id: "p-gran", name: "Gran", member_id: "m-gran", archived_at: "2026-01-01T00:00:00Z" };

describe("activeProfiles / archivedProfiles", () => {
  it("split on archived_at, where '' means active", () => {
    expect(activeProfiles([mom, dad, gran])).toEqual([mom, dad]);
    expect(archivedProfiles([mom, dad, gran])).toEqual([gran]);
  });
});

describe("viewProfileId", () => {
  it("narrows to the selected person when there are two or more to tell apart", () => {
    expect(viewProfileId([mom, dad], "p-dad")).toBe("p-dad");
  });

  it("does not narrow with one profile, whatever is selected", () => {
    // With one person every record is theirs or the household's. Narrowing
    // would hide nothing a switcher exists to reveal, and there is no switcher.
    expect(viewProfileId([mom], "p-mom")).toBe("");
    expect(viewProfileId([], "")).toBe("");
  });

  it("counts only active profiles toward having someone to tell apart", () => {
    expect(viewProfileId([mom, gran], "p-mom")).toBe("");
  });

  it("falls back to everyone when the selection is gone or archived", () => {
    // Never an empty screen: a stale selection after an archive on another
    // device must not filter every list down to nothing.
    expect(viewProfileId([mom, dad, gran], "p-gran")).toBe("");
    expect(viewProfileId([mom, dad], "p-nobody")).toBe("");
    expect(viewProfileId([mom, dad], "")).toBe("");
  });
});

describe("profileInView", () => {
  it("is the only active profile, with no selection needed", () => {
    expect(profileInView([mom], "")).toBe(mom);
    expect(profileInView([mom, gran], "")).toBe(mom);
  });

  it("is the selected profile when several are active", () => {
    expect(profileInView([mom, dad], "p-dad")).toBe(dad);
  });

  it("is nobody when several are active and none is selected", () => {
    expect(profileInView([mom, dad], "")).toBeNull();
    expect(profileInView([mom, dad, gran], "p-gran")).toBeNull();
  });

  it("is nobody when there are no active profiles", () => {
    expect(profileInView([], "")).toBeNull();
    expect(profileInView([gran], "p-gran")).toBeNull();
  });
});

describe("forProfile", () => {
  const rows = [
    { id: "a", profile_id: "p-mom" },
    { id: "b", profile_id: "p-dad" },
    { id: "c", profile_id: "" },
    { id: "d" },
  ];

  it("returns every row when nothing is narrowed", () => {
    expect(forProfile(rows, "")).toBe(rows);
  });

  it("keeps the person's rows and the ones that name nobody", () => {
    // A row from before profiles existed, or a visit for the whole household,
    // has to stay visible under each person or it is visible under none.
    expect(forProfile(rows, "p-mom").map(r => r.id)).toEqual(["a", "c", "d"]);
    expect(forProfile(rows, "p-dad").map(r => r.id)).toEqual(["b", "c", "d"]);
  });
});

describe("showsProfileTag", () => {
  it("tags rows only when the list mixes people", () => {
    expect(showsProfileTag([mom, dad], "")).toBe(true);
    expect(showsProfileTag([mom, dad], "p-mom")).toBe(false);
    expect(showsProfileTag([mom], "")).toBe(false);
    expect(showsProfileTag([], "")).toBe(false);
  });

  it("counts an archived profile, whose records are still in the list", () => {
    expect(showsProfileTag([mom, gran], "")).toBe(true);
  });
});

describe("profileName", () => {
  it("resolves a name, and is empty for nobody or an unknown id", () => {
    expect(profileName([mom, dad], "p-dad")).toBe("Dad");
    expect(profileName([mom, dad], "")).toBe("");
    expect(profileName([mom, dad], "p-nobody")).toBe("");
  });

  it("still names an archived person", () => {
    expect(profileName([mom, gran], "p-gran")).toBe("Gran");
  });
});

describe("linkableMembers", () => {
  const members = [{ id: "m-mom" }, { id: "m-gran" }, { id: "m-sam" }];

  it("leaves out members another profile is already linked to, archived ones included", () => {
    // The database allows one profile per member and does not care whether
    // the profile holding the link is archived.
    expect(linkableMembers(members, [mom, dad, gran]).map(m => m.id)).toEqual(["m-sam"]);
  });

  it("keeps the edited profile's own link selectable", () => {
    expect(linkableMembers(members, [mom, dad, gran], "p-mom").map(m => m.id)).toEqual(["m-mom", "m-sam"]);
  });
});

describe("untaggedCount", () => {
  it("counts log entries and appointments that name nobody", () => {
    const observations = [{ profile_id: "" }, { profile_id: "p-mom" }, {}];
    const appointments = [{ profile_id: "" }, { profile_id: "p-dad" }];
    expect(untaggedCount(observations, appointments)).toBe(3);
    expect(untaggedCount([{ profile_id: "p-mom" }], [])).toBe(0);
  });
});

describe("ageOn", () => {
  it("counts whole years, turning over on the birthday itself", () => {
    expect(ageOn("1944-03-09", "2026-03-08")).toBe(81);
    expect(ageOn("1944-03-09", "2026-03-09")).toBe(82);
    expect(ageOn("1944-03-09", "2026-12-31")).toBe(82);
  });

  it("is null for anything it cannot honestly answer", () => {
    expect(ageOn("", "2026-03-09")).toBeNull();
    expect(ageOn("March 1944", "2026-03-09")).toBeNull();
    expect(ageOn("2030-01-01", "2026-03-09")).toBeNull();
    expect(ageOn("1800-01-01", "2026-03-09")).toBeNull();
    expect(ageOn("1944-03-09", "")).toBeNull();
  });
});

describe("isCalendarDate", () => {
  it("accepts real dates, leap days included", () => {
    expect(isCalendarDate("1944-03-09")).toBe(true);
    expect(isCalendarDate("1944-02-29")).toBe(true);
    expect(isCalendarDate("2000-02-29")).toBe(true);
    expect(isCalendarDate("0044-03-09")).toBe(true);
  });

  it("refuses a date-shaped string that names no day", () => {
    expect(isCalendarDate("1944-13-09")).toBe(false);
    expect(isCalendarDate("1944-00-10")).toBe(false);
    expect(isCalendarDate("1944-02-31")).toBe(false);
    expect(isCalendarDate("1943-02-29")).toBe(false);
    expect(isCalendarDate("1900-02-29")).toBe(false);
    expect(isCalendarDate("1944-04-00")).toBe(false);
  });

  it("refuses anything not written YYYY-MM-DD", () => {
    for (const value of ["", null, undefined, "1944", "March 1944", "1944-3-9", "1944-03-09T00:00:00Z"]) {
      expect(isCalendarDate(value)).toBe(false);
    }
  });
});

describe("a stored date of birth that is not a real date", () => {
  // Reachable only from outside the form (the date input cannot produce one),
  // which is exactly why it must not be able to take the screen down.
  it("is shown as stored instead of throwing", () => {
    expect(() => fmtBirth("1944-13-09", "2026-10-11")).not.toThrow();
    expect(fmtBirth("1944-13-09", "2026-10-11")).toBe("1944-13-09");
    expect(fmtBirth("1944-00-10", "2026-10-11")).toBe("1944-00-10");
  });

  it("is never rolled over into a different day", () => {
    // 31 February would otherwise read back as 2 March, with an age attached.
    expect(fmtBirth("1944-02-31", "2026-10-11")).toBe("1944-02-31");
    expect(ageOn("1944-02-31", "2026-10-11")).toBeNull();
    expect(ageOn("1944-13-09", "2026-10-11")).toBeNull();
    expect(ageOn("1944-03-09", "2026-13-40")).toBeNull();
  });

  it("still renders the rest of the profile", () => {
    const entries = profileEntries({ name: "Mom", born_on: "1944-13-09", diet: "Low salt" }, "2026-10-11");
    expect(entries.map(e => [e.key, e.value])).toEqual([["born_on", "1944-13-09"], ["diet", "Low salt"]]);
  });
});

describe("fmtBirth", () => {
  it("shows the date with the year and the age", () => {
    const text = fmtBirth("1944-03-09", "2026-10-11");
    expect(text).toMatch(/1944/);
    expect(text).toMatch(/\(age 82\)$/);
  });

  it("passes through a value it cannot parse, and is empty for none", () => {
    expect(fmtBirth("around 1944", "2026-10-11")).toBe("around 1944");
    expect(fmtBirth("", "2026-10-11")).toBe("");
  });
});

describe("profileEntries", () => {
  it("lists only the filled fields, in form order", () => {
    const entries = profileEntries({ ...mom, diet: "Low salt", residence: "At home", pharmacy: "" }, "2026-10-11");
    expect(entries.map(e => e.key)).toEqual(["residence", "diet"]);
    expect(entries[1]).toMatchObject({ label: "Diet", long: true, value: "Low salt" });
    expect(entries[0].long).toBe(false);
  });

  it("is empty for a profile with only a name", () => {
    expect(profileEntries(mom, "2026-10-11")).toEqual([]);
  });

  it("formats the date of birth", () => {
    const [entry] = profileEntries({ ...mom, born_on: "1944-03-09" }, "2026-10-11");
    expect(entry.key).toBe("born_on");
    expect(entry.value).toMatch(/age 82/);
  });
});

describe("profileChanges", () => {
  const before = { id: "p-mom", name: "Mom", member_id: null, diet: "Low salt", pharmacy: "", updated_at: "x" };

  it("returns only the columns that differ", () => {
    // A whole-row write from a stale copy would restore every field a sibling
    // had just changed. Only the touched columns may reach the UPDATE.
    expect(profileChanges(before, { name: "Mom", member_id: null, diet: "Low salt, soft food", pharmacy: "" }))
      .toEqual({ diet: "Low salt, soft food" });
  });

  it("is empty when nothing changed, treating a missing field as blank", () => {
    expect(profileChanges(before, { name: "Mom", member_id: null, diet: "Low salt", pharmacy: "", baseline: "" })).toEqual({});
  });

  it("reports linking and unlinking a member", () => {
    expect(profileChanges(before, { ...before, member_id: "m-mom" })).toEqual({ member_id: "m-mom" });
    expect(profileChanges({ ...before, member_id: "m-mom" }, { ...before, member_id: null })).toEqual({ member_id: null });
  });

  it("never reports a column the form does not own", () => {
    const changed = profileChanges(before, { ...before, id: "other", archived_at: "now", updated_at: "y", created_by: "z" });
    expect(changed).toEqual({});
  });
});

describe("PROFILE_COLUMNS", () => {
  it("is the name, the member link and every form field, all plain identifiers", () => {
    // These names are spliced into the profile UPDATE's SET list.
    expect(PROFILE_COLUMNS).toEqual(["name", "member_id", ...PROFILE_FIELDS.map(f => f.key)]);
    for (const column of PROFILE_COLUMNS) expect(column).toMatch(/^[a-z_]+$/);
  });
});

// ── Vitals ────────────────────────────────────────────────────────────────────

describe("VITAL_KINDS", () => {
  it("gives every kind a label and at least one unit with a sane range", () => {
    for (const kind of VITAL_KINDS) {
      expect(kind.label).toBeTruthy();
      expect(vitalUnits(kind).length).toBeGreaterThan(0);
      for (const [min, max] of Object.values(kind.ranges)) expect(min).toBeLessThan(max);
    }
    expect(new Set(VITAL_KINDS.map(k => k.id)).size).toBe(VITAL_KINDS.length);
  });

  it("resolves a kind by id and is null for an unknown one", () => {
    expect(vitalKind("bp").label).toBe("Blood pressure");
    expect(vitalKind("mood")).toBeNull();
  });
});

describe("canLogVitals", () => {
  const momProfile = { id: "p-mom", member_id: "m-mom", archived_at: "" };
  const dadProfile = { id: "p-dad", member_id: null, archived_at: "" };

  it("lets any adult record for anyone", () => {
    expect(canLogVitals({ id: "m-sam" }, momProfile, true)).toBe(true);
    expect(canLogVitals({ id: "m-sam" }, dadProfile, true)).toBe(true);
  });

  it("lets a person who is not an adult here record for their own profile only", () => {
    // They write own_vitals, where the hub stamps the row with them.
    expect(canLogVitals({ id: "m-mom" }, momProfile, false)).toBe(true);
    expect(canLogVitals({ id: "m-mom" }, dadProfile, false)).toBe(false);
    expect(canLogVitals({ id: "m-kid" }, momProfile, false)).toBe(false);
  });

  it("never matches an unlinked profile against a member with no id", () => {
    expect(canLogVitals({ id: null }, dadProfile, false)).toBe(false);
    expect(canLogVitals({}, dadProfile, false)).toBe(false);
  });

  it("refuses an archived profile, a missing profile and a missing member", () => {
    expect(canLogVitals({ id: "m-sam" }, { ...momProfile, archived_at: "2026-01-01T00:00:00Z" }, true)).toBe(false);
    expect(canLogVitals({ id: "m-sam" }, null, true)).toBe(false);
    expect(canLogVitals(null, momProfile, true)).toBe(false);
  });
});

describe("parseReading", () => {
  it("returns the values as the text to store", () => {
    expect(parseReading("pulse", "bpm", "72")).toEqual({ ok: true, value: "72", value2: "" });
    expect(parseReading("bp", "mmHg", "128", "82")).toEqual({ ok: true, value: "128", value2: "82" });
    expect(parseReading("weight", "kg", " 67.5 ")).toEqual({ ok: true, value: "67.5", value2: "" });
  });

  it("accepts a comma as the decimal mark", () => {
    expect(parseReading("temp", "°C", "37,2")).toEqual({ ok: true, value: "37.2", value2: "" });
  });

  it("refuses what is not a plain number", () => {
    for (const raw of ["", "abc", "12 0", "-5", "+5", "1e3", "72bpm", ".", "1,2,3", "７２"]) {
      expect(parseReading("pulse", "bpm", raw).ok, raw).toBe(false);
    }
  });

  it("accepts a number written without a leading or trailing digit", () => {
    expect(parseReading("sleep", "hours", ".5")).toEqual({ ok: true, value: "0.5", value2: "" });
    expect(parseReading("sleep", "hours", "7.")).toEqual({ ok: true, value: "7", value2: "" });
  });

  it("never stores a value the app cannot read back", () => {
    // String(0.0000001) is "1e-7", which readingNumber calls not a number.
    const tiny = parseReading("sleep", "hours", "0.0000001");
    expect(tiny).toEqual({ ok: true, value: "0", value2: "" });
    expect(parseReading("weight", "lb", "148.456").value).toBe("148.46");
  });

  it("gives the two units of one kind the same span", () => {
    // 320 kg was accepted while the same weight in pounds (705) was refused.
    for (const kind of VITAL_KINDS) {
      const units = vitalUnits(kind);
      if (units.length < 2) continue;
      const [a, b] = units;
      for (const edge of [0, 1]) {
        const inB = convertUnit(kind.ranges[a][edge], a, b);
        const slack = Math.abs(kind.ranges[b][edge]) * 0.005 + 0.05;
        expect(Math.abs(inB - kind.ranges[b][edge]), `${kind.id} ${a}→${b} ${edge ? "max" : "min"}`).toBeLessThanOrEqual(slack);
      }
    }
  });

  it("refuses a blood pressure whose two numbers round to the same value", () => {
    expect(parseReading("bp", "mmHg", "80.004", "80.001").ok).toBe(false);
    expect(parseReading("bp", "mmHg", "80.02", "80.01")).toEqual({ ok: true, value: "80.02", value2: "80.01" });
  });

  it("refuses a value outside the range for its unit", () => {
    // 150 is a weight in pounds and not a temperature in anything.
    expect(parseReading("temp", "°F", "150").ok).toBe(false);
    expect(parseReading("weight", "kg", "320").ok).toBe(false);
    expect(parseReading("weight", "lb", "500").ok).toBe(true);
    expect(parseReading("oxygen", "%", "101").ok).toBe(false);
    expect(parseReading("pulse", "bpm", "72").ok).toBe(true);
  });

  it("names the field and the limits in the message", () => {
    expect(parseReading("oxygen", "%", "30").error).toBe("Oxygen must be between 50 and 100 %.");
    expect(parseReading("pain", "of 10", "11").error).toBe("Pain must be between 0 and 10.");
    expect(parseReading("bp", "mmHg", "128", "").error).toBe("Bottom number must be a number.");
  });

  it("takes whole numbers only on a scale", () => {
    expect(parseReading("pain", "of 10", "3.5").error).toBe("Pain must be a whole number.");
    expect(parseReading("appetite", "of 5", "0").ok).toBe(false);
    expect(parseReading("pain", "of 10", "0")).toEqual({ ok: true, value: "0", value2: "" });
  });

  it("refuses a blood pressure entered the wrong way round", () => {
    expect(parseReading("bp", "mmHg", "82", "128").error).toMatch(/top number must be higher/);
    expect(parseReading("bp", "mmHg", "90", "90").ok).toBe(false);
  });

  it("refuses an unknown kind or a unit the kind does not use", () => {
    expect(parseReading("mood", "x", "3").ok).toBe(false);
    expect(parseReading("weight", "stone", "10").ok).toBe(false);
  });
});

describe("fmtReading / readingNumber", () => {
  it("shows one number or two, with the unit", () => {
    expect(fmtReading({ value: "128", value2: "82", unit: "mmHg" })).toBe("128/82 mmHg");
    expect(fmtReading({ value: "98.60", value2: "", unit: "°F" })).toBe("98.6 °F");
    expect(fmtReading({ value: "3", value2: "", unit: "of 5" })).toBe("3 of 5");
    expect(fmtReading({ value: "72", value2: "", unit: "" })).toBe("72");
  });

  it("shows a stored value that is not a number as it was stored", () => {
    expect(fmtReading({ value: "high", value2: "", unit: "mmHg" })).toBe("high mmHg");
    expect(fmtReading({ value: null, value2: "", unit: "" })).toBe("");
    expect(Number.isNaN(readingNumber("high"))).toBe(true);
    expect(readingNumber("67,5")).toBe(67.5);
  });
});

describe("ownReading / canDeleteReading", () => {
  const adultRow = { id: "a", profile_id: "p-mom", recorded_by: "m-sam" };
  const ownRow = ownReading({ id: "o", member_id: "m-mom" });

  it("marks a self-logged row and names who the hub says wrote it", () => {
    expect(ownRow).toMatchObject({ own: true, member_id: "m-mom", recorded_by: "m-mom" });
  });

  it("lets any adult remove a reading an adult recorded, and nobody else", () => {
    expect(canDeleteReading({ id: "m-pat" }, adultRow, true)).toBe(true);
    // Not the person it is about, and not even whoever is named as recording it.
    expect(canDeleteReading({ id: "m-mom" }, adultRow, false)).toBe(false);
    expect(canDeleteReading({ id: "m-sam" }, adultRow, false)).toBe(false);
  });

  it("lets only the person who logged their own reading remove it, adults included", () => {
    expect(canDeleteReading({ id: "m-mom" }, ownRow, false)).toBe(true);
    expect(canDeleteReading({ id: "m-sam" }, ownRow, true)).toBe(false);
    expect(canDeleteReading({ id: "m-kid" }, ownRow, false)).toBe(false);
  });

  it("refuses a missing member or reading, and a member with no id", () => {
    expect(canDeleteReading(null, adultRow, true)).toBe(false);
    expect(canDeleteReading({ id: "m-sam" }, null, true)).toBe(false);
    expect(canDeleteReading({}, ownReading({ id: "o2" }), false)).toBe(false);
  });
});

describe("vitalsFor / readingsByKind", () => {
  const mom = { id: "p-mom", member_id: "m-mom" };
  const dad = { id: "p-dad", member_id: null };
  const vitals = [
    { id: "a", profile_id: "p-mom", kind: "bp", measured_at: "2026-10-01T08:00:00.000Z" },
    { id: "b", profile_id: "p-mom", kind: "bp", measured_at: "2026-10-03T08:00:00.000Z" },
    { id: "c", profile_id: "p-dad", kind: "bp", measured_at: "2026-10-02T08:00:00.000Z" },
    { id: "d", profile_id: "p-mom", kind: "weight", measured_at: "2026-10-02T08:00:00.000Z" },
    { id: "e", profile_id: "p-mom", kind: "aura", measured_at: "2026-10-02T08:00:00.000Z" },
    { id: "f", profile_id: "", kind: "bp", measured_at: "2026-10-02T08:00:00.000Z" },
    ownReading({ id: "g", member_id: "m-mom", kind: "pulse", measured_at: "2026-10-04T08:00:00.000Z" }),
    ownReading({ id: "h", member_id: "m-kid", kind: "pulse", measured_at: "2026-10-04T09:00:00.000Z" }),
  ];

  it("keeps the readings adults recorded against the profile, never the unnamed ones", () => {
    // Unlike a visit, a reading for nobody must not appear on anybody's chart.
    expect(vitalsFor(vitals, dad).map(v => v.id)).toEqual(["c"]);
  });

  it("adds what the profile's own member logged, matched on who the hub says wrote it", () => {
    expect(vitalsFor(vitals, mom).map(v => v.id)).toEqual(["a", "b", "d", "e", "g"]);
  });

  it("puts a self-logged row from anyone else on nobody's chart", () => {
    // The hub lets any member write own_vitals. What makes that safe is here:
    // a row some other member wrote counts only toward that member's profile.
    for (const profile of [mom, dad]) expect(vitalsFor(vitals, profile).some(v => v.id === "h")).toBe(false);
  });

  it("never matches a self-logged row against an unlinked profile", () => {
    const stray = ownReading({ id: "s", member_id: null, kind: "pulse" });
    const blank = ownReading({ id: "t", member_id: "", kind: "pulse" });
    expect(vitalsFor([stray, blank], dad)).toEqual([]);
    expect(vitalsFor([stray, blank], { id: "p-x", member_id: "" })).toEqual([]);
  });

  it("is not fooled by a self-logged row that carries a profile_id", () => {
    const forged = ownReading({ id: "z", member_id: "m-kid", profile_id: "p-mom", kind: "bp" });
    expect(vitalsFor([forged], mom)).toEqual([]);
  });

  it("puts the reading entered later first when two share a time", () => {
    const same = "2026-10-03T08:00:00.000Z";
    const groups = readingsByKind([
      { id: "first", kind: "bp", measured_at: same, created_at: "2026-10-03T08:00:10.000Z" },
      { id: "retake", kind: "bp", measured_at: same, created_at: "2026-10-03T08:00:50.000Z" },
    ]);
    expect(groups.get("bp").map(v => v.id)).toEqual(["retake", "first"]);
    const reversed = readingsByKind([
      { id: "retake", kind: "bp", measured_at: same, created_at: "2026-10-03T08:00:50.000Z" },
      { id: "first", kind: "bp", measured_at: same, created_at: "2026-10-03T08:00:10.000Z" },
    ]);
    expect(reversed.get("bp").map(v => v.id)).toEqual(["retake", "first"]);
  });

  it("groups by kind, newest first, dropping kinds the app does not know", () => {
    const groups = readingsByKind(vitalsFor(vitals, mom));
    expect([...groups.keys()].sort()).toEqual(["bp", "pulse", "weight"]);
    expect(groups.get("bp").map(v => v.id)).toEqual(["b", "a"]);
  });
});

describe("defaultUnit", () => {
  const weight = vitalKind("weight");
  it("offers the unit of the latest reading, else the kind's first", () => {
    expect(defaultUnit(weight, [{ unit: "kg" }, { unit: "lb" }])).toBe("kg");
    expect(defaultUnit(weight, [])).toBe("lb");
    expect(defaultUnit(weight, [{ unit: "stone" }, { unit: "kg" }])).toBe("kg");
  });
});

describe("convertUnit", () => {
  it("converts between the units a kind offers, both ways", () => {
    expect(convertUnit(100, "kg", "lb")).toBeCloseTo(220.46, 2);
    expect(convertUnit(220.46, "lb", "kg")).toBeCloseTo(100, 2);
    expect(convertUnit(98.6, "°F", "°C")).toBeCloseTo(37, 5);
    expect(convertUnit(37, "°C", "°F")).toBeCloseTo(98.6, 5);
    expect(convertUnit(5.5, "mmol/L", "mg/dL")).toBeCloseTo(99.09, 2);
    expect(convertUnit(72, "bpm", "bpm")).toBe(72);
  });

  it("is NaN when there is no conversion", () => {
    expect(Number.isNaN(convertUnit(10, "stone", "kg"))).toBe(true);
  });
});

describe("trendSeries", () => {
  const at = day => `2026-10-${String(day).padStart(2, "0")}T08:00:00.000Z`;

  it("orders oldest first whatever order it is given", () => {
    const series = trendSeries([
      { value: "72", value2: "", unit: "bpm", measured_at: at(3) },
      { value: "70", value2: "", unit: "bpm", measured_at: at(1) },
      { value: "75", value2: "", unit: "bpm", measured_at: at(2) },
    ]);
    expect(series.map(p => p.v)).toEqual([70, 75, 72]);
    expect(series.every(p => p.v2 === null)).toBe(true);
  });

  it("puts every point in the unit of the newest reading", () => {
    // A family that switches from pounds to kilograms must not see a cliff.
    const series = trendSeries([
      { value: "150", value2: "", unit: "lb", measured_at: at(1) },
      { value: "68", value2: "", unit: "kg", measured_at: at(2) },
    ]);
    expect(series[0].v).toBeCloseTo(68.04, 2);
    expect(series[1].v).toBe(68);
  });

  it("carries both numbers of a blood pressure", () => {
    const [point] = trendSeries([{ value: "128", value2: "82", unit: "mmHg", measured_at: at(1) }]);
    expect(point).toMatchObject({ v: 128, v2: 82 });
  });

  it("leaves out readings before the window, with an unreadable time, or not a number", () => {
    const series = trendSeries([
      { value: "70", value2: "", unit: "bpm", measured_at: at(1) },
      { value: "71", value2: "", unit: "bpm", measured_at: "not a time" },
      { value: "high", value2: "", unit: "bpm", measured_at: at(5) },
      { value: "10", value2: "", unit: "stone", measured_at: at(6) },
      { value: "74", value2: "", unit: "bpm", measured_at: at(9) },
    ], Date.parse(at(4)));
    expect(series.map(p => p.v)).toEqual([74]);
  });

  it("is empty for no readings", () => {
    expect(trendSeries([])).toEqual([]);
  });
});

describe("sparkline", () => {
  const p = (t, v, v2 = null) => ({ t, v, v2 });

  it("has nothing to draw with fewer than two points", () => {
    expect(sparkline([])).toBeNull();
    expect(sparkline([p(0, 70)])).toBeNull();
  });

  it("spans the box, with the highest value at the top", () => {
    const spark = sparkline([p(0, 60), p(50, 80), p(100, 70)], 120, 32, 3);
    expect(spark.line).toBe("3,29 60,3 117,16");
    expect(spark.line2).toBe("");
  });

  it("draws a flat series on the middle line instead of dividing by zero", () => {
    expect(sparkline([p(0, 72), p(100, 72)], 120, 32, 3).line).toBe("3,16 117,16");
  });

  it("puts readings taken at the same moment in the middle", () => {
    expect(sparkline([p(5, 60), p(5, 80)], 120, 32, 3).line).toBe("60,29 60,3");
  });

  it("draws both lines of a blood pressure on one scale", () => {
    const spark = sparkline([p(0, 120, 80), p(100, 140, 90)], 120, 32, 3);
    expect(spark.line).toBe("3,11.7 117,3");
    expect(spark.line2).toBe("3,29 117,24.7");
  });
});

describe("toLocalInput / localInputToIso", () => {
  it("round-trips a device-local minute", () => {
    const when = new Date(2026, 9, 11, 8, 5);
    expect(toLocalInput(when)).toBe("2026-10-11T08:05");
    expect(localInputToIso("2026-10-11T08:05", when.getTime())).toBe(when.toISOString());
  });

  it("refuses a time in the future, with a minute of grace", () => {
    const now = new Date(2026, 9, 11, 8, 5).getTime();
    expect(localInputToIso("2026-10-11T08:05", now - 30_000)).not.toBeNull();
    expect(localInputToIso("2026-10-11T08:07", now)).toBeNull();
    expect(localInputToIso("2026-10-12T08:05", now)).toBeNull();
  });

  it("refuses what is not a real date and time", () => {
    const now = new Date(2026, 9, 11, 8, 5).getTime();
    for (const value of ["", null, "2026-10-11", "2026-13-01T08:00", "2026-02-31T08:00", "yesterday", "0026-10-11T08:00", "1899-12-31T08:00"]) {
      expect(localInputToIso(value, now), String(value)).toBeNull();
    }
  });
});

describe("nextVitalsCursor / mergeOlderVitals", () => {
  const at = day => `2026-10-${String(day).padStart(2, "0")}T08:00:00.000Z`;
  const r = (id, day) => ({ id, measured_at: at(day) });
  // The hub's side of a page read, as the SQL states it: strictly after the
  // cursor in (measured_at, id) order, newest first.
  const page = (table, c, size) => table
    .filter(v => v.measured_at <= c.at && (v.measured_at < c.at || v.id < c.id))
    .sort((a, b) => b.measured_at.localeCompare(a.measured_at) || b.id.localeCompare(a.id))
    .slice(0, size);
  const walk = (table, loaded, cursor, size) => {
    let done = false, reads = 0;
    while (!done && reads < 5000) {
      const rows = page(table, cursor, size);
      ({ vitals: loaded, done } = mergeOlderVitals(loaded, rows, size));
      cursor = nextVitalsCursor(cursor, rows);
      reads++;
    }
    return { loaded, done, reads };
  };
  const ids = rows => rows.map(v => v.id).sort();

  it("starts later than any reading and moves to the last row a read returned", () => {
    expect(at(3) < VITALS_CURSOR_START.at).toBe(true);
    expect(nextVitalsCursor(VITALS_CURSOR_START, [r("a", 9), r("b", 3), r("c", 5)])).toEqual({ at: at(3), id: "b" });
  });

  it("orders rows that share a time by id", () => {
    expect(nextVitalsCursor(VITALS_CURSOR_START, [r("m", 3), r("b", 3), r("x", 3)])).toEqual({ at: at(3), id: "b" });
  });

  it("stays put on an empty read and never moves later", () => {
    const cursor = { at: at(3), id: "k" };
    expect(nextVitalsCursor(cursor, [])).toBe(cursor);
    expect(nextVitalsCursor(cursor, [r("z", 20), r("z", 3)])).toBe(cursor);
    expect(nextVitalsCursor(VITALS_CURSOR_START, [])).toBe(VITALS_CURSOR_START);
  });

  it("is done only when the page comes back short", () => {
    expect(mergeOlderVitals([r("a", 9)], [r("b", 3)], 3).done).toBe(true);
    expect(mergeOlderVitals([], [], 3).done).toBe(true);
    expect(mergeOlderVitals([], [r("a", 3), r("b", 2), r("c", 1)], 3).done).toBe(false);
  });

  it("does not call the history complete because a full page held nothing new", () => {
    // That rule is what ended paging early when a page was all one timestamp.
    const loaded = [r("a", 3), r("b", 3), r("c", 3)];
    const merged = mergeOlderVitals(loaded, [r("a", 3), r("b", 3), r("c", 3)], 3);
    expect(merged.done).toBe(false);
    expect(merged.vitals).toHaveLength(3);
  });

  it("keeps a self-logged reading and an adult's reading that happen to share an id", () => {
    const merged = mergeOlderVitals([r("same", 3)], [ownReading({ id: "same", member_id: "m", measured_at: at(2) })], 5);
    expect(merged.vitals).toHaveLength(2);
  });

  it("reaches every reading when walked page by page", () => {
    const table = Array.from({ length: 25 }, (_, i) => r(`x${String(i).padStart(2, "0")}`, 25 - i));
    const recent = table.slice(0, 4);
    const { loaded, done } = walk(table, recent, nextVitalsCursor(VITALS_CURSOR_START, recent), 5);
    expect(done).toBe(true);
    expect(ids(loaded)).toEqual(ids(table));
  });

  it("gets past more readings at one time than a page holds", () => {
    // With a cursor on the time alone, 2,001 readings at one instant returned
    // the same page for ever, and everything older was reported as not existing.
    const table = Array.from({ length: 13 }, (_, i) => r(`s${String(i).padStart(2, "0")}`, 10));
    table.push(r("older-1", 4), r("older-2", 2));
    const { loaded, done, reads } = walk(table, [], VITALS_CURSOR_START, 5);
    expect(done).toBe(true);
    expect(ids(loaded)).toEqual(ids(table));
    expect(reads).toBe(4);
  });

  it("is not thrown off by a backdated reading logged on this screen", () => {
    // The recent window holds days 20-25. The person then logs a reading dated
    // day 2. The cursor must still start from day 20, or days 3-19 are never
    // requested and the history is declared complete without them.
    const table = Array.from({ length: 25 }, (_, i) => r(`x${String(i + 1).padStart(2, "0")}`, i + 1));
    const recent = table.filter(v => v.measured_at >= "2026-10-20");
    const cursor = nextVitalsCursor(VITALS_CURSOR_START, recent);
    const backdated = { id: "new", measured_at: "2026-10-02T12:00:00.000Z" };
    table.push(backdated);
    expect(cursor).toEqual({ at: at(20), id: "x20" });
    const { loaded, done } = walk(table, [backdated, ...recent], cursor, 5);
    expect(done).toBe(true);
    expect(ids(loaded)).toEqual(ids(table));
    expect(loaded.filter(v => v.id === "new")).toHaveLength(1);
  });
});

describe("createResettableLoad", () => {
  const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

  it("applies a read that finishes with no reset in between", async () => {
    const load = createResettableLoad(), d = deferred(), applied = [];
    const started = load.start(() => d.promise, v => applied.push(v), () => applied.push("failed"));
    expect(load.busy).toBe(true);
    expect(load.promise).toBe(started);
    d.resolve("rows");
    await started;
    expect(applied).toEqual(["rows"]);
    expect(load.busy).toBe(false);
  });

  it("drops the result of a read that a reset overtook", async () => {
    // Open Vitals, switch to Profile while it loads, change the member link.
    // The old answer was scoped to the old link and must not refill the cache.
    const load = createResettableLoad(), d = deferred(), applied = [];
    const started = load.start(() => d.promise, v => applied.push(v), () => applied.push("failed"));
    load.reset();
    expect(load.busy).toBe(false);
    d.resolve("stale rows");
    await started;
    expect(applied).toEqual([]);
  });

  it("drops the failure of a read that a reset overtook", async () => {
    const load = createResettableLoad(), d = deferred(), seen = [];
    const started = load.start(() => d.promise, v => seen.push(v), () => seen.push("failed"));
    load.reset();
    d.reject(new Error("offline"));
    await started;
    expect(seen).toEqual([]);
  });

  it("lets a new read start after a reset, and the old one finishing does not end it", async () => {
    const load = createResettableLoad(), old = deferred(), fresh = deferred(), applied = [];
    const first = load.start(() => old.promise, v => applied.push(v), () => {});
    load.reset();
    const second = load.start(() => fresh.promise, v => applied.push(v), () => {});
    expect(load.promise).toBe(second);
    old.resolve("stale rows");
    await first;
    // Still busy with the new read: the old one settling must not clear it.
    expect(load.busy).toBe(true);
    expect(load.promise).toBe(second);
    fresh.resolve("fresh rows");
    await second;
    expect(applied).toEqual(["fresh rows"]);
    expect(load.busy).toBe(false);
  });

  it("reports a failure and is free again afterwards", async () => {
    const load = createResettableLoad(), seen = [];
    await load.start(() => Promise.reject(new Error("offline")), () => seen.push("applied"), e => seen.push(e.message));
    expect(seen).toEqual(["offline"]);
    expect(load.busy).toBe(false);
  });

  it("turns a read that throws before returning a promise into a failure", async () => {
    const load = createResettableLoad(), seen = [];
    await load.start(() => { throw new Error("bad sql"); }, () => seen.push("applied"), e => seen.push(e.message));
    expect(seen).toEqual(["bad sql"]);
  });
});

describe("defaultRecordRange", () => {
  it("covers the 90 days up to the household's today", () => {
    // Both ends are in the record, so 90 days ending 11 October start on 14 July.
    expect(defaultRecordRange("2026-10-11")).toEqual({ from: "2026-07-14", to: "2026-10-11" });
  });

  it("ends on the day it is given, not on this machine's clock", () => {
    // A member in another timezone logs an entry dated by the HOUSEHOLD's day.
    // The range has to end on that same day or it leaves the entry out.
    expect(defaultRecordRange("2026-04-01").to).toBe("2026-04-01");
    expect(defaultRecordRange("2031-01-01").to).toBe("2031-01-01");
  });

  it("crosses a year boundary and a leap day", () => {
    expect(defaultRecordRange("2027-01-15").from).toBe("2026-10-18");
    expect(defaultRecordRange("2028-03-31").from).toBe("2028-01-02");
  });

  it("is empty when it is not given a day", () => {
    expect(defaultRecordRange("")).toEqual({ from: "", to: "" });
    expect(defaultRecordRange(null)).toEqual({ from: "", to: "" });
    expect(defaultRecordRange("2026-02-31")).toEqual({ from: "", to: "" });
  });
});

describe("recordRangeError", () => {
  it("accepts a range, a one-sided range and no range", () => {
    expect(recordRangeError("2026-07-01", "2026-10-11")).toBe("");
    expect(recordRangeError("2026-10-11", "2026-10-11")).toBe("");
    expect(recordRangeError("", "2026-10-11")).toBe("");
    expect(recordRangeError("2026-07-01", "")).toBe("");
    expect(recordRangeError("", "")).toBe("");
  });

  it("refuses an inverted range and a bound that is not a date", () => {
    expect(recordRangeError("2026-10-12", "2026-10-11")).toBe("From must not be later than To.");
    expect(recordRangeError("2026-02-31", "")).toBe("From is not a date.");
    expect(recordRangeError("", "soon")).toBe("To is not a date.");
  });
});

describe("recordUrl", () => {
  const base = "https://hub.example/run/elder-care/";

  it("addresses one document with its format and dates", () => {
    expect(recordUrl("/run/elder-care/api/reports", "full_record", "html", "2026-07-13", "2026-10-11", base))
      .toBe("https://hub.example/run/elder-care/api/reports/full_record?format=html&from=2026-07-13&to=2026-10-11");
  });

  it("leaves an empty bound off, which asks for every date on that side", () => {
    expect(recordUrl("/run/elder-care/api/reports", "readings", "csv", "", "2026-10-11", base))
      .toBe("https://hub.example/run/elder-care/api/reports/readings?format=csv&to=2026-10-11");
  });

  it("escapes the view id", () => {
    expect(recordUrl("/r", "a/b?c", "html", "", "", base)).toBe("https://hub.example/r/a%2Fb%3Fc?format=html");
  });
});

describe("readWhenQuiet", () => {
  it("returns a read that nothing was written during", async () => {
    let reads = 0;
    expect(await readWhenQuiet(async () => { reads++; return "rows"; }, () => 7)).toBe("rows");
    expect(reads).toBe(1);
  });

  it("throws away a read a write overlapped, and reads again", async () => {
    // "Show earlier history" is out; a note is saved; the old answer arrives.
    // Used as it is, it would take the new note back off the screen.
    let version = 0, reads = 0;
    const read = async () => {
      reads++;
      if (reads === 1) { version++; return "without the new note"; }
      return "with the new note";
    };
    expect(await readWhenQuiet(read, () => version)).toBe("with the new note");
    expect(reads).toBe(2);
  });

  it("does not use a read that began in the middle of a write", async () => {
    // The write started before the read (version already moved once) and ends
    // during it (version moves again), so the rows may predate the write.
    let version = 1, reads = 0;
    const read = async () => { reads++; if (reads === 1) version++; return `read ${reads}`; };
    expect(await readWhenQuiet(read, () => version)).toBe("read 2");
  });

  it("gives up when the writing never stops", async () => {
    let version = 0, reads = 0;
    const read = async () => { reads++; version++; return "rows"; };
    await expect(readWhenQuiet(read, () => version, 3)).rejects.toThrow(/kept changing/);
    expect(reads).toBe(3);
  });

  it("passes a failed read straight through", async () => {
    await expect(readWhenQuiet(async () => { throw new Error("offline"); }, () => 0)).rejects.toThrow("offline");
  });
});

describe("readAllPages", () => {
  // The hub's side of one page: ids above the cursor, in id order.
  const pager = (table, size, asked = []) => async after => {
    asked.push(after);
    return table.filter(r => r.id > after).sort((a, b) => a.id.localeCompare(b.id)).slice(0, size);
  };
  const table = n => Array.from({ length: n }, (_, i) => ({ id: `r${String(i).padStart(4, "0")}` }));

  it("reads a table that fits in one page with one request", async () => {
    const asked = [];
    expect(await readAllPages(pager(table(3), 5, asked), 5)).toHaveLength(3);
    expect(asked).toEqual([""]);
  });

  it("reads every row of a table longer than a page, each exactly once", async () => {
    const all = table(23), asked = [];
    const rows = await readAllPages(pager(all, 5, asked), 5);
    expect(rows.map(r => r.id)).toEqual(all.map(r => r.id));
    expect(asked).toEqual(["", "r0004", "r0009", "r0014", "r0019"]);
  });

  it("asks once more when the table is an exact number of pages, and stops on the empty one", async () => {
    const asked = [];
    expect(await readAllPages(pager(table(10), 5, asked), 5)).toHaveLength(10);
    expect(asked).toHaveLength(3);
  });

  it("reads an empty table", async () => {
    expect(await readAllPages(pager([], 5), 5)).toEqual([]);
  });

  it("stops instead of asking for the same full page for ever", async () => {
    const stuck = async () => [{ id: "a" }, { id: "a" }];
    await expect(readAllPages(stuck, 2)).rejects.toThrow(/in order/);
  });

  it("gives up on a table longer than it is willing to walk", async () => {
    await expect(readAllPages(pager(table(50), 5), 5, 3)).rejects.toThrow(/too long/);
  });

  it("passes a failed page straight through", async () => {
    await expect(readAllPages(async () => { throw new Error("offline"); }, 5)).rejects.toThrow("offline");
  });
});

describe("history sort order", () => {
  it("puts visits and appointments in date then time order", () => {
    const rows = [
      { id: "c", date: "2026-03-02", time: "09:00" },
      { id: "a", date: "2026-03-01", time: "18:00" },
      { id: "b", date: "2026-03-01", time: "" },
      { id: "d", date: "2026-03-01", time: "09:00" },
    ];
    expect(sortByDateTime(rows).map(r => r.id)).toEqual(["b", "d", "a", "c"]);
    expect(rows.map(r => r.id)).toEqual(["c", "a", "b", "d"]);
  });

  it("puts tasks open first, dated before undated, soonest due first, then newest", () => {
    const rows = [
      { id: "done-new", status: "done", due_date: "", created_at: "2026-03-05" },
      { id: "open-undated-old", status: "open", due_date: "", created_at: "2026-03-01" },
      { id: "open-late", status: "open", due_date: "2026-04-01", created_at: "2026-03-01" },
      { id: "open-undated-new", status: "open", due_date: "", created_at: "2026-03-09" },
      { id: "open-soon", status: "open", due_date: "2026-03-10", created_at: "2026-03-01" },
      { id: "done-dated", status: "done", due_date: "2026-03-01", created_at: "2026-03-01" },
    ];
    expect(sortTasks(rows).map(r => r.id)).toEqual(["open-soon", "open-late", "open-undated-new", "open-undated-old", "done-dated", "done-new"]);
  });

  it("puts log entries newest first", () => {
    const rows = [{ id: "a", observed_at: "2026-03-01T10:00:00Z" }, { id: "b", observed_at: "2026-03-03T10:00:00Z" }, { id: "c", observed_at: "2026-03-02T10:00:00Z" }];
    expect(sortObservations(rows).map(r => r.id)).toEqual(["b", "c", "a"]);
  });

  it("is steady for rows that tie, and tolerates a missing value", () => {
    const tie = [{ id: "b", date: "2026-03-01", time: "09:00" }, { id: "a", date: "2026-03-01", time: "09:00" }];
    expect(sortByDateTime(tie).map(r => r.id)).toEqual(["a", "b"]);
    expect(() => sortTasks([{ id: "x" }, { id: "y", status: "done" }])).not.toThrow();
    expect(() => sortObservations([{ id: "x" }, { id: "y", observed_at: null }])).not.toThrow();
  });
});

describe("withStoredRow", () => {
  const list = [{ id: "a", title: "one" }, { id: "b", title: "two" }, { id: "c", title: "three" }];

  it("puts the stored row in place of the copy held, where it was", () => {
    const next = withStoredRow(list, "b", { id: "b", title: "changed" });
    expect(next).toEqual([{ id: "a", title: "one" }, { id: "b", title: "changed" }, { id: "c", title: "three" }]);
  });

  it("takes the row out when the hub no longer has it", () => {
    expect(withStoredRow(list, "b", null).map(r => r.id)).toEqual(["a", "c"]);
  });

  it("leaves the list alone when the read failed", () => {
    expect(withStoredRow(list, "b", undefined)).toBe(list);
  });

  it("does not add a row the list was not showing", () => {
    expect(withStoredRow(list, "z", { id: "z", title: "new" }).map(r => r.id)).toEqual(["a", "b", "c"]);
  });

  it("never changes the list it was given", () => {
    withStoredRow(list, "b", null);
    withStoredRow(list, "a", { id: "a", title: "changed" });
    expect(list.map(r => r.title)).toEqual(["one", "two", "three"]);
  });
});

// ── A paid caregiver ──────────────────────────────────────────────────────────

describe("isGuest / helpsHandsOn", () => {
  const aide = { id: "m-aide", role: "guest" };
  const kid = { id: "m-kid", role: "child" };
  const sam = { id: "m-sam", role: "adult" };

  it("knows a guest by role and nothing else", () => {
    expect(isGuest(aide)).toBe(true);
    expect(isGuest(kid)).toBe(false);
    expect(isGuest(sam)).toBe(false);
    expect(isGuest(null)).toBe(false);
    expect(isGuest({ id: "guest" })).toBe(false);
  });

  it("offers the hands-on controls to adults and guests, not to a child", () => {
    expect(helpsHandsOn(sam, true)).toBe(true);
    expect(helpsHandsOn(aide, false)).toBe(true);
    expect(helpsHandsOn(kid, false)).toBe(false);
    expect(helpsHandsOn(null, true)).toBe(false);
  });
});

describe("a caregiver logging a reading", () => {
  const aide = { id: "m-aide", role: "guest" };
  const kid = { id: "m-kid", role: "child" };
  const momProfile = { id: "p-mom", member_id: "m-mom", archived_at: "" };
  const dadProfile = { id: "p-dad", member_id: null, archived_at: "" };

  it("is offered for any active profile, linked to a member or not", () => {
    expect(canLogVitals(aide, momProfile, false)).toBe(true);
    expect(canLogVitals(aide, dadProfile, false)).toBe(true);
    expect(canLogVitals(aide, { ...dadProfile, archived_at: "2026-01-01T00:00:00Z" }, false)).toBe(false);
  });

  it("is still not offered to a child for somebody else", () => {
    expect(canLogVitals(kid, momProfile, false)).toBe(false);
    expect(canLogVitals(kid, dadProfile, false)).toBe(false);
  });

  it("goes to the profile's table, and only a person logging for themselves uses their own", () => {
    expect(logsOwnReading(aide, momProfile, false)).toBe(false);
    expect(logsOwnReading({ id: "m-mom", role: "child" }, momProfile, false)).toBe(true);
    // An adult writes the profile's table even for their own profile.
    expect(logsOwnReading({ id: "m-mom", role: "adult" }, momProfile, true)).toBe(false);
    // A guest who is themselves the person cared for logs as that person.
    expect(logsOwnReading({ id: "m-mom", role: "guest" }, momProfile, false)).toBe(true);
    expect(logsOwnReading(aide, dadProfile, false)).toBe(false);
    expect(logsOwnReading(null, momProfile, false)).toBe(false);
    expect(logsOwnReading(aide, null, false)).toBe(false);
  });
});

describe("sortShifts / runningShift", () => {
  const shifts = [
    { id: "s-a", member_id: "m-aide", started_at: "2026-01-05T09:00:00.000Z", ended_at: "2026-01-05T13:00:00.000Z" },
    { id: "s-c", member_id: "m-aide", started_at: "2026-01-07T09:00:00.000Z", ended_at: "" },
    { id: "s-b", member_id: "m-sam", started_at: "2026-01-06T09:00:00.000Z", ended_at: "" },
    { id: "s-d", member_id: "m-aide", started_at: "2026-01-07T09:00:00.000Z", ended_at: "" },
  ];

  it("puts the newest first, and breaks a tie on the id so the order is stable", () => {
    expect(sortShifts(shifts).map(s => s.id)).toEqual(["s-d", "s-c", "s-b", "s-a"]);
  });

  it("does not reorder the list it was given", () => {
    sortShifts(shifts);
    expect(shifts.map(s => s.id)).toEqual(["s-a", "s-c", "s-b", "s-d"]);
  });

  it("finds a member's own running shift and nobody else's", () => {
    expect(runningShift(shifts, "m-sam").id).toBe("s-b");
    expect(runningShift(shifts, "m-aide").id).toBe("s-d");
    expect(runningShift(shifts, "m-kid")).toBe(null);
    expect(runningShift(shifts, "")).toBe(null);
    expect(runningShift([shifts[0]], "m-aide")).toBe(null);
  });
});

describe("canEditShift", () => {
  const shift = { id: "s1", member_id: "m-aide" };
  it("lets whoever logged it and any adult, and nobody else", () => {
    expect(canEditShift({ id: "m-aide", role: "guest" }, shift, false)).toBe(true);
    expect(canEditShift({ id: "m-sam", role: "adult" }, shift, true)).toBe(true);
    expect(canEditShift({ id: "m-other", role: "guest" }, shift, false)).toBe(false);
    expect(canEditShift({ id: "m-kid", role: "child" }, shift, false)).toBe(false);
    expect(canEditShift(null, shift, true)).toBe(false);
    expect(canEditShift({ id: "m-aide" }, null, false)).toBe(false);
    // A member without an id owns nothing, even a row that also has none.
    expect(canEditShift({ id: "" }, { id: "s2", member_id: "" }, false)).toBe(false);
  });
});

describe("shiftLength", () => {
  it("reads as hours and minutes", () => {
    expect(shiftLength("2026-01-05T09:00:00.000Z", "2026-01-05T13:15:00.000Z")).toBe("4 h 15 min");
    expect(shiftLength("2026-01-05T09:00:00.000Z", "2026-01-05T15:00:00.000Z")).toBe("6 h");
    expect(shiftLength("2026-01-05T09:00:00.000Z", "2026-01-05T09:40:00.000Z")).toBe("40 min");
    expect(shiftLength("2026-01-05T09:00:00.000Z", "2026-01-05T09:00:00.000Z")).toBe("0 min");
  });
  it("counts through midnight", () => {
    expect(shiftLength("2026-01-05T22:00:00.000Z", "2026-01-06T06:30:00.000Z")).toBe("8 h 30 min");
  });
  it("says nothing for a running shift or times it cannot read", () => {
    expect(shiftLength("2026-01-05T09:00:00.000Z", "")).toBe("");
    expect(shiftLength("yesterday", "2026-01-05T09:00:00.000Z")).toBe("");
    expect(shiftLength("2026-01-05T13:00:00.000Z", "2026-01-05T09:00:00.000Z")).toBe("");
  });
});

describe("shiftTimesError", () => {
  const start = "2026-01-05T09:00:00.000Z";
  it("accepts a finished shift and one still running", () => {
    expect(shiftTimesError(start, "2026-01-05T13:00:00.000Z")).toBe("");
    expect(shiftTimesError(start, "")).toBe("");
  });
  it("refuses a start or an end the form could not turn into a time", () => {
    expect(shiftTimesError(null, "")).toMatch(/started/);
    expect(shiftTimesError("", "")).toMatch(/started/);
    expect(shiftTimesError(start, null)).toMatch(/ended/);
  });
  it("refuses an end at or before the start", () => {
    expect(shiftTimesError(start, start)).toMatch(/end after it starts/);
    expect(shiftTimesError(start, "2026-01-05T08:59:00.000Z")).toMatch(/end after it starts/);
  });
  it("refuses a shift longer than two days, which is a wrong date", () => {
    expect(shiftTimesError(start, "2026-01-07T09:00:00.000Z")).toBe("");
    expect(shiftTimesError(start, "2026-01-07T09:01:00.000Z")).toMatch(/two days/);
  });
});

describe("latestHandoff", () => {
  const done = (id, ended_at, handoff) => ({ id, member_id: "m-aide", started_at: "2026-01-01T00:00:00.000Z", ended_at, handoff });
  it("is the handoff of the shift that ended last, whenever it started", () => {
    const shifts = [done("s1", "2026-01-05T13:00:00.000Z", "First"), done("s2", "2026-01-06T13:00:00.000Z", "Second")];
    expect(latestHandoff(shifts).id).toBe("s2");
    expect(latestHandoff([...shifts].reverse()).id).toBe("s2");
  });
  it("skips a shift that left no note, and one that is still running", () => {
    const shifts = [
      done("s1", "2026-01-05T13:00:00.000Z", "Read this"),
      done("s2", "2026-01-06T13:00:00.000Z", "   "),
      done("s3", "", "Not handed over yet"),
    ];
    expect(latestHandoff(shifts).id).toBe("s1");
  });
  it("is null when nobody has left one", () => {
    expect(latestHandoff([])).toBe(null);
    expect(latestHandoff([done("s1", "2026-01-05T13:00:00.000Z", "")])).toBe(null);
  });
});

describe("NOTE_AUDIENCES / isFamilyOnly", () => {
  it("offers exactly the two values the row policy knows, everyone first", () => {
    expect(NOTE_AUDIENCES.map(a => a.id)).toEqual(["everyone", "family"]);
  });
  it("treats only the exact value as family only", () => {
    expect(isFamilyOnly({ visibility: "family" })).toBe(true);
    expect(isFamilyOnly({ visibility: "everyone" })).toBe(false);
    // A row from before the column existed, and the demo's rows, have none.
    expect(isFamilyOnly({})).toBe(false);
    expect(isFamilyOnly(null)).toBe(false);
  });
});

describe("canEditReading", () => {
  const byAide = { id: "x1", profile_id: "p-mom", recorded_by: "m-aide" };
  it("lets whoever recorded a reading and any adult correct it", () => {
    expect(canEditReading({ id: "m-aide", role: "guest" }, byAide, false)).toBe(true);
    expect(canEditReading({ id: "m-sam", role: "adult" }, byAide, true)).toBe(true);
  });
  it("lets nobody else", () => {
    expect(canEditReading({ id: "m-other", role: "guest" }, byAide, false)).toBe(false);
    expect(canEditReading({ id: "m-kid", role: "child" }, byAide, false)).toBe(false);
    expect(canEditReading(null, byAide, true)).toBe(false);
    expect(canEditReading({ id: "m-aide" }, null, false)).toBe(false);
    expect(canEditReading({ id: "" }, { id: "x2", recorded_by: "" }, false)).toBe(false);
  });
  it("offers no correction for a reading a person logged for themselves, even to an adult", () => {
    const own = ownReading({ id: "o1", member_id: "m-mom" });
    expect(canEditReading({ id: "m-mom", role: "child" }, own, false)).toBe(false);
    expect(canEditReading({ id: "m-sam", role: "adult" }, own, true)).toBe(false);
  });
});

describe("shiftChanges", () => {
  const opened = { start: "2026-01-05T09:00", end: "", profile_id: "p-mom", summary: "", handoff: "" };
  it("is empty when nothing was touched", () => {
    expect(shiftChanges(opened, { ...opened })).toEqual([]);
  });
  it("names only the fields that differ, in form order", () => {
    expect(shiftChanges(opened, { ...opened, start: "2026-01-05T08:30" })).toEqual(["start"]);
    expect(shiftChanges(opened, { ...opened, handoff: "Keys are with the neighbour", end: "2026-01-05T13:00" })).toEqual(["end", "handoff"]);
    expect(shiftChanges(opened, { start: "a", end: "b", profile_id: "", summary: "c", handoff: "d" })).toEqual(SHIFT_FORM_FIELDS);
  });
  it("leaves the notes and the end out of an edit that only moved the start", () => {
    // The page this was opened on still showed the shift running with no
    // notes. Whatever the caregiver has written since must not be in the write.
    const changed = shiftChanges(opened, { ...opened, start: "2026-01-05T08:45" });
    expect(changed).not.toContain("summary");
    expect(changed).not.toContain("handoff");
    expect(changed).not.toContain("end");
  });
  it("sees a cleared field as a change, and a missing one as empty", () => {
    expect(shiftChanges({ ...opened, end: "2026-01-05T13:00" }, opened)).toEqual(["end"]);
    expect(shiftChanges({}, { start: "", end: "", profile_id: "", summary: "", handoff: "" })).toEqual([]);
    expect(shiftChanges(null, { summary: "x" })).toEqual(["summary"]);
  });
});

describe("fieldConflicts", () => {
  const opened = { start: "2026-01-05T09:00", end: "", profile_id: "p-mom", summary: "", handoff: "" };
  it("is empty when nobody else has changed what this person changed", () => {
    expect(fieldConflicts(opened, { ...opened }, ["handoff"])).toEqual([]);
    // Someone else ended the shift; this person only wrote a handoff.
    expect(fieldConflicts(opened, { ...opened, end: "2026-01-05T13:00" }, ["handoff"])).toEqual([]);
  });
  it("names a field both people changed", () => {
    const fresh = { ...opened, handoff: "Ate little at lunch", end: "2026-01-05T13:00" };
    expect(fieldConflicts(opened, fresh, ["handoff"])).toEqual(["handoff"]);
    expect(fieldConflicts(opened, fresh, ["start", "end", "handoff"])).toEqual(["end", "handoff"]);
  });
  it("reads a missing field as empty on either side", () => {
    expect(fieldConflicts({}, { handoff: "" }, ["handoff"])).toEqual([]);
    expect(fieldConflicts(null, { handoff: "x" }, ["handoff"])).toEqual(["handoff"]);
  });
});

describe("mergeNote", () => {
  it("puts their text first and mine after it", () => {
    expect(mergeNote("Ate little at lunch", "Keys are with the neighbour")).toBe("Ate little at lunch\nKeys are with the neighbour");
  });
  it("is just the one text when the other is empty", () => {
    expect(mergeNote("", "Mine")).toBe("Mine");
    expect(mergeNote("Theirs", "")).toBe("Theirs");
    expect(mergeNote(null, undefined)).toBe("");
  });
  it("repeats nothing when one already holds the other", () => {
    expect(mergeNote("Ate little", "Ate little at lunch")).toBe("Ate little at lunch");
    expect(mergeNote("Ate little at lunch", "little")).toBe("Ate little at lunch");
    expect(mergeNote("Same", " Same ")).toBe("Same");
  });
  it("can be applied again to its own result without growing", () => {
    const once = mergeNote("Theirs", "Mine");
    expect(mergeNote("Theirs", once)).toBe(once);
  });
});

describe("nextRevision", () => {
  const read = "2026-01-05T13:00:00.000Z";
  it("is the clock when the clock is ahead of what was read", () => {
    expect(nextRevision(read, "2026-01-05T13:00:00.001Z")).toBe("2026-01-05T13:00:00.001Z");
    expect(nextRevision(read, "2026-01-06T08:00:00.000Z")).toBe("2026-01-06T08:00:00.000Z");
  });
  it("is never the value that was read, so the guard on it cannot match a row somebody else has written", () => {
    // Two writes in the same millisecond.
    expect(nextRevision(read, read)).toBe("2026-01-05T13:00:00.001Z");
    // A device whose clock is behind the one that wrote last.
    expect(nextRevision(read, "2026-01-05T12:00:00.000Z")).toBe("2026-01-05T13:00:00.001Z");
  });
  it("always moves forward, however many slow-clock writes follow each other", () => {
    let rev = read;
    const seen = new Set([rev]);
    for (let i = 0; i < 5; i++) {
      const next = nextRevision(rev, "2026-01-01T00:00:00.000Z");
      expect(next > rev).toBe(true);
      expect(seen.has(next)).toBe(false);
      seen.add(next); rev = next;
    }
  });
  it("falls back to the clock for a stored value that is not a time", () => {
    for (const bad of ["", null, undefined, "yesterday"]) {
      expect(nextRevision(bad, "2026-01-05T13:00:00.000Z")).toBe("2026-01-05T13:00:00.000Z");
    }
  });
});

describe("failureLine", () => {
  const what = { action: "add the task", thing: "task" };
  const err = (props, message = "hub text") => Object.assign(new Error(message), props);

  it("says a duplicate already exists, by code or by the hub's text", () => {
    expect(failureLine(err({ status: 400, code: "UNIQUE_CONSTRAINT" }), what)).toBe("That task already exists.");
    expect(failureLine(err({ status: 400 }, "UNIQUE constraint failed: app_elder_care__tasks.id"), what)).toBe("That task already exists.");
  });
  it("says a refusal is not allowed, without naming a role", () => {
    expect(failureLine(err({ status: 403 }), what)).toBe("You don’t have permission to add the task.");
  });
  it("says a full household store is full", () => {
    expect(failureLine(err({ status: 507 }), what)).toBe("The household’s storage is full — free up space first.");
  });
  it("says a row that is gone has been removed", () => {
    expect(failureLine({ status: 404 }, what)).toBe("This task has been removed.");
  });
  it("says a conflict was someone else's change", () => {
    expect(failureLine(err({ status: 409 }), what)).toBe("This task was changed by someone else — check it first.");
  });
  it("asks to try again only when trying again can work", () => {
    for (const e of [err({}), err({ status: 0 }), err({ status: 400 }), err({ status: 500 }), err({ status: 503 }), null, undefined]) {
      expect(failureLine(e, what)).toBe("Couldn’t add the task — try again.");
    }
  });
  it("never shows the hub's own text", () => {
    for (const status of [undefined, 400, 403, 404, 409, 500, 507]) {
      expect(failureLine(err({ status }, "Row policy refused write"), what)).not.toMatch(/Row policy/);
    }
  });
});
