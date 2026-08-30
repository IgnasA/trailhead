# Local-markdown issue tracker

This repo has no external issue tracker configured, so wayfinding uses this
directory as the tracker. (To wire up a real tracker, run
`/setup-matt-pocock-skills`.)

## Wayfinding operations

- **Maps** are the root-level `map*.md` files, each labelled `wayfinder:map`.
  One per effort, in the order they were charted:
  - [Implement the Trailhead MVP wireframes](map.md) — complete.
  - [Add your own flight data](map-manual-flights.md) — complete.
- **Tickets** are files in `tickets/`, named `NNN-slug.md`. The `NNN` number is
  the ticket's issue id and is unique across every map; the `title` in its
  frontmatter is its name. Always refer to tickets by name, linking the file.
- **Ticket frontmatter**:

  ```yaml
  ---
  title: <ticket name>
  label: wayfinder:<research|prototype|grilling|task>
  status: open | closed
  assignee: <empty when unclaimed>
  map: <relative path to the map this ticket belongs to>
  blocked-by: [<ticket numbers>]   # native blocking relationship
  ---
  ```

  `map:` is absent on tickets 001-022, which predate the second map; those
  belong to [map.md](map.md).

- **Claiming**: set `assignee:` to yourself *before* any work. An open,
  unassigned ticket is unclaimed.
- **Blocking**: the `blocked-by:` list is the native dependency relationship.
  A ticket is unblocked when every ticket it lists is `status: closed`.
- **Frontier query**: open + unassigned + every `blocked-by` entry closed.
  In practice:

  ```bash
  grep -l 'status: open' tracker/tickets/*.md
  ```

  then check each hit's `assignee` and `blocked-by` against the closed set.
- **Resolving**: append a `## Resolution` section to the ticket (the answer),
  set `status: closed`, and add one line to the map's *Decisions so far*.
- **Assets** created while resolving a ticket are linked from the ticket, not
  pasted in.
