# Elder Care

A [Chickadee Bandit](https://chickadeebandit.com/app-library/elder-care) app.

The sandwich-generation companion to the family hub: adult siblings (and anyone in the care circle) coordinating care for a parent or loved one.

- **Visit rotation** — who is stopping by and when, so no day goes uncovered.
- **Care tasks** — "who's calling the doctor?" made explicit, with an assignee and due date.
- **Appointments** — provider, time, location, notes, and who's taking them.
- **Observation log** — a shared feed of what everyone noticed (mood, health, meds), so the person who visits Tuesday knows what happened Monday.
- **Profiles** — one for each person being cared for: where they live, their doctor and pharmacy, conditions, allergies, diet, mobility, and what a normal day looks like.

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
