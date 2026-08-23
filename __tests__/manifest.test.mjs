import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dirname, "../manifest.json"), "utf-8"));

const VALID_STORAGE   = ["kv", "db", "none"];
const VALID_AUDIENCES = ["everyone", "adults", "children"];

describe("manifest.json", () => {
  it("has required string fields", () => {
    for (const field of ["id", "name", "version", "description", "entrypoint", "runtime", "icon"]) {
      expect(manifest[field], `missing field: ${field}`).toBeTruthy();
    }
  });

  it("entrypoint is index.html", () => expect(manifest.entrypoint).toBe("index.html"));
  it("runtime is static",        () => expect(manifest.runtime).toBe("static"));

  it("storage is declared and valid", () => {
    expect(manifest.storage, "storage field is required").toBeTruthy();
    expect(VALID_STORAGE).toContain(manifest.storage);
  });

  it("version follows semver", () => expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/));

  it("permissions.default_audience is valid", () => {
    expect(VALID_AUDIENCES).toContain(manifest.permissions.default_audience);
  });

  it("permissions.requires_approval is boolean", () => {
    expect(typeof manifest.permissions.requires_approval).toBe("boolean");
  });

  it("data_access has reads and writes arrays", () => {
    expect(Array.isArray(manifest.data_access.reads)).toBe(true);
    expect(Array.isArray(manifest.data_access.writes)).toBe(true);
  });
});

// ── retraction ────────────────────────────────────────────────────────────────
//
// Appointments and visits can be removed but not rescheduled, so the way a
// calendar entry made from one goes stale is deletion: the appointment is gone
// and the entry still tells whoever is driving to be somewhere on Tuesday. The
// calendar's `retract_dated_event` takes it back down, scoped by the reference
// the announcement carried — so announcing and retracting MUST agree on that
// reference, and both must actually be published.
describe("cancellation events", () => {
  const indexHtml = readFileSync(join(__dirname, "../src/index.html"), "utf-8");

  it("declares a cancellation event for each dated thing it announces, adults only", () => {
    for (const type of ["elder_care.appointment_cancelled", "elder_care.visit_cancelled"]) {
      expect(manifest.publishes).toContain(type);
      // These drive a trusted write in another app (hiding a calendar entry),
      // so a child must not be able to POST a fabricated one. Matches the ACL
      // on the announcement each retracts.
      expect(manifest.publish_acls[type]).toEqual({ require_role: "adult" });
    }
  });

  it("announces and retracts under the same reference", () => {
    // Namespaced by app AND kind: the column is shared with every other
    // publisher, and visits and appointments have separate id spaces.
    expect(indexHtml).toContain('calendarRef("appt", row.id)');
    expect(indexHtml).toContain('calendarRef("appt", id)');
    expect(indexHtml).toContain('calendarRef("visit", row.id)');
    expect(indexHtml).toContain('calendarRef("visit", id)');
  });

  /**
   * One function's source, from its `async function` line to the closing brace
   * in column 0. Bounding this matters more than it looks: an earlier version
   * sliced to end-of-file, so deleting deleteAppt's retraction entirely left
   * the test matching deleteVisit's — the guard passed on the code of the
   * function it was not guarding.
   */
  function functionBody(name) {
    const start = indexHtml.indexOf(`async function ${name}(`);
    expect(start, `${name} must exist`).toBeGreaterThan(-1);
    const end = indexHtml.indexOf("\n}\n", start);
    expect(end, `${name} must be brace-terminated in column 0`).toBeGreaterThan(start);
    return indexHtml.slice(start, end);
  }

  it("scopes each delete function's body to itself", () => {
    // Guards the guard: if functionBody ever over-reads again, these fail
    // rather than silently widening every assertion built on it.
    expect(functionBody("deleteAppt")).not.toContain("deleteVisit");
    expect(functionBody("deleteVisit")).not.toContain("deleteAppt");
    expect(functionBody("deleteAppt")).not.toContain("elder_care.visit_cancelled");
    expect(functionBody("deleteVisit")).not.toContain("elder_care.appointment_cancelled");
  });

  it("publishes the retraction only after the row is really gone", () => {
    // A retraction sent before the DELETE commits would hide the calendar entry
    // for an appointment that is still in the app — worse than the stale entry
    // it exists to prevent, because nothing would ever put it back.
    for (const [fn, type] of [["deleteAppt", "appointment_cancelled"], ["deleteVisit", "visit_cancelled"]]) {
      const body = functionBody(fn);
      const catchAt = body.indexOf("catch (e)");
      const publishAt = body.indexOf(`publishRetraction("elder_care.${type}"`);
      expect(catchAt, `${fn} must handle a failed delete`).toBeGreaterThan(-1);
      expect(publishAt, `${fn} must publish its own retraction`).toBeGreaterThan(-1);
      expect(publishAt, `${fn} must publish after the catch, not inside the try`).toBeGreaterThan(catchAt);
      // And the catch must return, or a failed delete would fall through to it.
      expect(body.slice(catchAt, publishAt)).toMatch(/return;/);
    }
  });

  it("uses the retracting publish lane, not the fire-and-forget one", () => {
    // `publish` swallows every failure. That is right for an announcement and
    // wrong for a retraction: the dropped one leaves a calendar entry standing
    // for something that no longer exists, and nothing else would ever catch it.
    for (const fn of ["deleteAppt", "deleteVisit"]) {
      const body = functionBody(fn);
      expect(body, `${fn} must await its retraction`).toContain("await publishRetraction(");
      expect(body.replace(/publishRetraction\(/g, ""), `${fn} must not fire-and-forget`).not.toMatch(/\bpublish\(/);
    }
  });
});

// ── ai_access SQL file validation ─────────────────────────────────────────────
// Auto-discovers all db_exports/db_mutations/db_inserts/db_deletes entries and
// validates each SQL file for type, household_id filter, and single-statement.

if (manifest.ai_access) {
  const ai = manifest.ai_access;

  const SQL_TYPES = [
    { field: "db_exports",   dir: "queries",   keyword: /^(SELECT|WITH)\b/i, label: "SELECT or WITH" },
    { field: "db_mutations", dir: "mutations",  keyword: /^UPDATE\b/i,        label: "UPDATE"         },
    { field: "db_inserts",   dir: "inserts",    keyword: /^INSERT\b/i,        label: "INSERT"         },
    { field: "db_deletes",   dir: "deletes",    keyword: /^DELETE\b/i,        label: "DELETE"         },
  ];

  for (const { field, dir, keyword, label } of SQL_TYPES) {
    const names = ai[field] ?? [];
    if (names.length === 0) continue;

    describe(`ai_access.${field}`, () => {
      it(`each name has a src/${dir}/{name}.sql file`, () => {
        for (const name of names) {
          const path = join(__dirname, `../src/${dir}/${name}.sql`);
          expect(existsSync(path), `missing: src/${dir}/${name}.sql`).toBe(true);
        }
      });

      it(`each SQL file starts with ${label}`, () => {
        for (const name of names) {
          const path = join(__dirname, `../src/${dir}/${name}.sql`);
          if (!existsSync(path)) continue;
          const sql = readFileSync(path, "utf-8").trim();
          expect(
            keyword.test(sql),
            `src/${dir}/${name}.sql must start with ${label}, got: ${sql.slice(0, 50)}`
          ).toBe(true);
        }
      });

      it(`each SQL file is a single statement (no semicolons)`, () => {
        for (const name of names) {
          const path = join(__dirname, `../src/${dir}/${name}.sql`);
          if (!existsSync(path)) continue;
          const sql = readFileSync(path, "utf-8");
          expect(
            sql.includes(";"),
            `src/${dir}/${name}.sql must not contain semicolons`
          ).toBe(false);
        }
      });
    });
  }

  if (ai.db_inserts?.length) {
    describe("ai_access.db_inserts schemas", () => {
      it("each insert has a src/schemas/{name}.json file", () => {
        for (const name of ai.db_inserts) {
          const path = join(__dirname, `../src/schemas/${name}.json`);
          expect(existsSync(path), `missing: src/schemas/${name}.json`).toBe(true);
        }
      });

      it("each schema file is valid JSON", () => {
        for (const name of ai.db_inserts) {
          const path = join(__dirname, `../src/schemas/${name}.json`);
          if (!existsSync(path)) continue;
          expect(
            () => JSON.parse(readFileSync(path, "utf-8")),
            `src/schemas/${name}.json must be valid JSON`
          ).not.toThrow();
        }
      });

      it("each schema declares type:array with an items definition", () => {
        for (const name of ai.db_inserts) {
          const path = join(__dirname, `../src/schemas/${name}.json`);
          if (!existsSync(path)) continue;
          let schema;
          try { schema = JSON.parse(readFileSync(path, "utf-8")); } catch { continue; }
          expect(schema.type, `src/schemas/${name}.json must declare "type": "array"`).toBe("array");
          expect(
            Array.isArray(schema.items) || (typeof schema.items === "object" && schema.items !== null),
            `src/schemas/${name}.json must declare "items" to validate params`
          ).toBe(true);
        }
      });

      it("schema maxItems matches the number of $N placeholders in the SQL", () => {
        for (const name of ai.db_inserts) {
          const sqlPath    = join(__dirname, `../src/inserts/${name}.sql`);
          const schemaPath = join(__dirname, `../src/schemas/${name}.json`);
          if (!existsSync(sqlPath) || !existsSync(schemaPath)) continue;
          const sql = readFileSync(sqlPath, "utf-8");
          let schema;
          try { schema = JSON.parse(readFileSync(schemaPath, "utf-8")); } catch { continue; }
          const paramNums = [...sql.matchAll(/\$(\d+)/g)].map(m => parseInt(m[1], 10));
          const maxParam  = paramNums.length > 0 ? Math.max(...paramNums) : 0;
          expect(
            schema.maxItems,
            `src/schemas/${name}.json maxItems (${schema.maxItems}) must equal SQL $N count (${maxParam})`
          ).toBe(maxParam);
        }
      });
    });
  }
}
