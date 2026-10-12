# Elder Care

A [Chickadee Bandit](https://chickadeebandit.com/app-library/elder-care) app.

The sandwich-generation companion to the family hub: adult siblings (and anyone in the care circle) coordinating care for a parent or loved one.

- **Visit rotation** — who is stopping by and when, so no day goes uncovered.
- **Care tasks** — "who's calling the doctor?" made explicit, with an assignee and due date.
- **Appointments** — provider, time, location, notes, and who's taking them.
- **Observation log** — a shared feed of what everyone noticed (mood, health, meds), so the person who visits Tuesday knows what happened Monday.
- **Profiles** — one for each person being cared for: where they live, their doctor and pharmacy, conditions, allergies, diet, mobility, and what a normal day looks like.
- **Shift log** — for a paid caregiver: arrived, left, what was done, and a handoff note for whoever comes next.

## A paid caregiver

Someone the family employs does not need to be a member of the household. Invite them as a
**guest** from the hub's Guests page and grant them this app. A guest has their own login and an
end date, can be removed at any time, and cannot open the printed record. Guest access lasts up to
a year and can be extended.

In the app a guest lands on the Shifts tab. They can:

- start a shift, keep notes while it runs, and end it with a handoff note, or log a past shift;
- tick a care task off, and reopen it;
- log a reading for the person they care for, and correct one they logged with the Correct button
  beside it. Only an adult can remove a reading.

They read the schedule, the tasks, the appointments, the profile and the log. They cannot add or
change any of those, and they cannot remove anything.

**Family-only notes.** A log entry can be marked "Family only" when it is written, or later with the
button on the entry. The hub then returns it to the adults of the household and to nobody else, so
a guest and a child never receive it. Family-only entries are left out of the printed record, which
is often handed to the person taking them to the appointment.

How the hub enforces it. `shifts`, `vitals`, `tasks` and `observations` use one policy shape
(`owner_or_visibility` with `write_visibility_scoped`, `delete_adult_only` and a
`column_write_acls` entry for every column):

| Table | A person who is not an adult may | Adults |
| --- | --- | --- |
| `shifts` | add their own, change their own | change or remove any |
| `vitals` | add a reading, change one they recorded | change or remove any |
| `tasks` | write `status`, `completed_at`, `completed_by`, `completed_by_name` | everything |
| `observations` | nothing | everything, including who reads an entry |

The hub stamps `shifts.member_id` and `vitals.recorded_by` with the caller on every insert and lets
nobody rewrite them. `tasks.completed_by` is what the page sends. A shift, a reading and a ticked
task each keep the person's name beside their id, because a guest's seat is removed when the job
ends and the record should still say who it was.

A shift is written by two people, the caregiver and any adult, from pages that do not refresh. So
every save reads the shift again first and writes only the fields that person changed. A field
somebody else changed in the meantime is not written over: the person gets the shift as it now
is, with both texts in a note's box, and saves again. A shift an adult has already ended is not
ended a second time from the caregiver's card; what the caregiver had typed is carried into the
Edit form so it can be added.

The read and the write are tied together by the shift's `updated_at`, used as a revision. Each
write names the value it read (`WHERE ... AND updated_at = ?`) and sets a later one, so a save
that lands between another save's read and its write leaves that write matching nothing. The page
then reads the shift again and decides afresh. If the re-read itself fails, the save fails and
nothing is written; the page never falls back to its own older copy.

The hub does not tell a guest from a child: both are members who are not adults. So the table
above holds for a child too. The page offers these controls to adults and guests only, and a
household that does not want a child to reach them can restrict the app for that child. A test
(`__tests__/manifest.test.mjs`) fails if a migration adds a column to one of these tables without
a write rule, because a column with no rule is writable by any member on any row.

In a shared care space everyone is an adult from a household of their own, so there are no guests
and "family only" means everyone in the space.

## Vitals

The Vitals tab holds readings for one person: blood pressure, pulse, weight, blood sugar,
temperature, oxygen, sleep, appetite and pain. Each kind shows its latest reading and a trend over
the last 90 days. A reading is checked when it is entered (a blood pressure typed the wrong way
round is refused) and can be given in either unit where there are two.

Any adult can log a reading for anyone, and so can a guest caregiver. The person a profile is
linked to can log their own, even when they are not an adult in this hub. Two tables hold them:

- `vitals` holds what was recorded for a person. The hub stamps each row with whoever wrote it. An
  adult can change or remove any row; anyone else can change only a row they recorded and can
  remove none.
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
- **Readings** and **Readings they logged themselves**: by person and kind, newest first. A reading
  also prints the name its recorder had at the time, which still reads after that person's seat
  is gone (a guest whose job has ended).
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

Adults manage entries; everyone with the app can read, apart from family-only notes. Built on the
same `storage: db` + `row_policies` patterns as the rest of the catalog.

## Quick start

```bash
npm run dev     # http://localhost:3001
npm run build   # produces dist/bundle.json
npm test        # manifest + contract checks
```
