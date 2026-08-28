# Imported design: MVP Wireframes

Imported 2026-08-28 from the Claude Design project
<https://claude.ai/design/p/a303c989-2415-46c7-82c3-5f5dae0da407?file=MVP+Wireframes.dc.html>
("Design style decision"). All files below were verified byte-for-byte (SHA-256)
against the project at import time.

- `MVP Wireframes.dc.html` — the wireframes: ten annotated greybox frames (1a–1j)
  covering the Trailhead MVP first-run path — landing, permissions/trust, import
  progress, the three-stop reveal, dashboard (KPI / map / trips), flight detail
  with provenance + source email, and the two mobile frames. The `<sc-if>` blocks
  and the trailing `text/x-dc` script are Claude Design canvas plumbing
  (`showNotes` / `showCallouts` toggles), not part of the product design.
- `_ds/modernist-99a44c1e-5f8c-4141-9231-cb5ee9543f2f/` — the "Modernist" design
  system the wireframes consume: `styles.css` (the token sheet and component
  classes — the source of truth for the look), `readme.md` (usage guide),
  `_ds_bundle.js` and `_ds_manifest.json` (canvas metadata).

Not imported: `support.js` (69 KB) — it is the generated Claude Design canvas
runtime ("GENERATED from dc-runtime/src/*.ts — do not edit"), not project design
content. Consequence: opening the `.dc.html` file directly in a browser renders
the frames but not the canvas toggles. The wireframes' full `_ds` design system
(foundations/, components/, templates/ referenced by its readme) lives in the
source design-system project, not in this wireframes project; only the five
files above exist here.

To re-sync from the design project later, run `/design-login` once in an
interactive Claude Code session, after which the `DesignSync` tool can read the
project directly (this import had to go through the browser because that
authorization was missing).
