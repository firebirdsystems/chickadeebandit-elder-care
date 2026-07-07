# Elder Care

The sandwich-generation companion to the family hub: adult siblings (and anyone in the care circle) coordinating care for a parent or loved one.

- **Visit rotation** — who is stopping by and when, so no day goes uncovered.
- **Care tasks** — "who's calling the doctor?" made explicit, with an assignee and due date.
- **Appointments** — provider, time, location, notes, and who's taking them.
- **Observation log** — a shared feed of what everyone noticed (mood, health, meds), so the person who visits Tuesday knows what happened Monday.

Adults manage entries; everyone in the household can read. Built on the same `storage: db` +
`row_policies` patterns as the rest of the catalog.

## Quick start

```bash
npm run dev     # http://localhost:3001
npm run build   # produces dist/bundle.json
npm test        # manifest + contract checks
```
