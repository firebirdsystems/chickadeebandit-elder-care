# Elder Care

A [Chickadee Bandit](https://chickadeebandit.com/app-library/elder-care) app.

The sandwich-generation companion to the family hub: adult siblings (and anyone in the care circle) coordinating care for a parent or loved one.

- **Visit rotation** — who is stopping by and when, so no day goes uncovered.
- **Care tasks** — "who's calling the doctor?" made explicit, with an assignee and due date.
- **Appointments** — provider, time, location, notes, and who's taking them.
- **Observation log** — a shared feed of what everyone noticed (mood, health, meds), so the person who visits Tuesday knows what happened Monday.
- **Profiles** — one for each person being cared for: where they live, their doctor and pharmacy, conditions, allergies, diet, mobility, and what a normal day looks like.

## Vitals

The Vitals tab holds readings for one person: blood pressure, pulse, weight, blood sugar,
temperature, oxygen, sleep, appetite and pain. Each kind shows its latest reading and a trend over
the last 90 days. A reading is checked when it is entered (a blood pressure typed the wrong way
round is refused) and can be given in either unit where there are two.

Any adult can log a reading for anyone. The person a profile is linked to can log their own, even
when they are not an adult in this hub. The hub enforces both, with two tables:

- `vitals` holds what adults recorded. Only an adult can add, change or remove a row.
- `own_vitals` holds what a person logged for themselves. The hub stamps each row with whoever
  wrote it, and only that person can change or remove it. The page shows such a reading on the
  profile linked to that member and nowhere else, so a row written by anyone else is on nobody's
  chart.

Because self-logged readings are found through the profile's member link, changing that link takes
them off the profile until it is restored. The app says so before saving.

The numbers, unit and note of a reading are encrypted at rest. Its kind, its time and whose it is
are not, because the app filters and orders on them.

## The record for a doctor visit

The Profile tab offers adults a record to take to an appointment. It is rendered by the hub from
the manifest's `reports`, as whoever asks and through the same row policies as the app itself:

- **Care profile**: one line per filled-in field, per person.
- **Readings** and **Readings they logged themselves**: by person and kind, newest first.
- **Observation log** and **Appointments**: by person, newest first.

"Open the record" binds all five into one document, 90 days by default. The care profile is not
filtered by date. Each report can also be opened on its own or downloaded as CSV.

- Rows are ordered by person and each one names who it is about. An entry that names nobody is
  listed last with the person left blank. The hub cannot print a heading per person, because it
  groups only on the column a report is sorted by and a name is encrypted.
- A person whose profile is archived is left out of the record. Restoring the profile brings their
  entries back.
- The dates are the household's calendar days. Each reading and log entry stores the household day
  it fell on beside its UTC time, and the reports filter on that day, so a reading taken on the
  evening of the 31st is in a record "to the 31st" wherever the household is. Each row prints that
  day beside its time in UTC. An entry written before the column existed is filed by its UTC date.
- Medications are not in the record. A report reads only its own app's tables, and medications are
  kept under the Medications app's own access rules, so that app prints its own list of current
  medications and of doses taken. Whoever manages medications there can open it: any adult in a
  household, the steward in a shared space. The card says where to look without promising a tab
  the reader may not have.
- The hub allows ten documents per person every five minutes and at most 10,000 rows per report.
  Past either limit it answers with a short message in the new tab.

## More than one person

Every visit, task, appointment and log entry can say who it is about. With two or more profiles a
switcher appears above the tabs, and each list narrows to that person. A visit or a task may be for
everyone; a log entry or an appointment always names one person. Records written before profiles
existed name nobody and show under everyone until an adult settles them from the Profile tab.

A profile can be linked to that person's own membership, or left unlinked for someone who does not
use the hub. Profiles are archived, not deleted, so the records that name them are kept.

Adults manage entries; everyone in the household can read. Built on the same `storage: db` +
`row_policies` patterns as the rest of the catalog.

## Quick start

```bash
npm run dev     # http://localhost:3001
npm run build   # produces dist/bundle.json
npm test        # manifest + contract checks
```
