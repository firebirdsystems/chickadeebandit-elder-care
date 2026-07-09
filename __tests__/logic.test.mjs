import { describe, it, expect } from "vitest";
import {
  CATEGORIES, fmtDate, fmtWhen, memberName, catOf,
  scheduleList, appointmentList, openTasks, doneTasks,
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
