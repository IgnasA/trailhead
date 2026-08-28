# Local-markdown issue tracker

This repo has no external issue tracker configured, so wayfinding uses this
directory as the tracker. (To wire up a real tracker, run
`/setup-matt-pocock-skills`.)

## Wayfinding operations

- **The map** is [map.md](map.md) — the single issue labelled `wayfinder:map`.
- **Tickets** are files in `tickets/`, named `NNN-slug.md`. The `NNN` number is
  the ticket's issue id; the `title` in its frontmatter is its name. Always
  refer to tickets by name, linking the file.
- **Ticket frontmatter**:

  ```yaml
  ---
  title: <ticket name>
  label: wayfinder:<research|prototype|grilling|task>
  status: open | closed
  assignee: <empty when unclaimed>
  blocked-by: [<ticket numbers>]   # native blocking relationship
  ---
  ```

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
