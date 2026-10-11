import { describe, it, expect } from "vitest";
import {
  CATEGORIES, fmtDate, fmtWhen, memberName, catOf,
  scheduleList, appointmentList, openTasks, doneTasks, searchableFields, calendarRef,
  PROFILE_FIELDS, PROFILE_COLUMNS, activeProfiles, archivedProfiles, viewProfileId,
  profileInView, forProfile, showsProfileTag, profileName, linkableMembers,
  untaggedCount, isCalendarDate, ageOn, fmtBirth, profileEntries, profileChanges,
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
