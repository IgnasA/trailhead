---
title: Privacy and deletion model
label: wayfinder:grilling
status: closed
assignee: Ignas + Claude (this session)
blocked-by: [004]
---

## Question

The wireframes make precise privacy promises that need a settled model behind
them before the screens and the privacy page can be written:

- Frame 1b's store / never-store table (store: extracted flight records,
  message id + subject, a hash; never: bodies, non-flight mail, attachments)
  — and its note that the permission-screen copy "should match the app's
  privacy page word-for-word".
- Frame 1b note 3: "delete my emails" (source-email metadata) and "delete my
  history" (derived flight records) are *two separate, separately-worded
  actions*, because derived history survives deletion of source metadata.
- Frame 1h: email bodies are fetched live with the stored `gmail_message_id`
  and never persisted; disconnecting Gmail must be possible "any time".

Grill to decide: exactly what each deletion action removes (records, hashes,
OAuth tokens, account itself), what disconnect-without-delete means, retention
of the eval dataset built from user corrections ("Correct this flight" labels
are user data too), and the privacy-page copy. Blocked by
[Gmail access and OAuth verification constraints](004-gmail-access-and-verification.md)
because Google's Limited Use policy constrains what may be stored and how
deletion must behave.

## Resolution

One grilling round, all recommendations accepted:

- **Disconnect Gmail**: revoke at Google + delete from Vault + mark
  connection disconnected. All data stays.
- **"Delete my emails"**: deletes `source_emails`, cascading extractions and
  provenance links; flights survive; provenance panel shows "source deleted".
- **"Delete my history"**: deletes flights, trips, corrections; keeps source
  emails + extractions, so a regretted deletion rebuilds instantly from
  stored extractions without re-reading Gmail. Both deletions together =
  genuine zero.
- **Account deletion**: total cascade — token revoked at Google first, auth
  user removed, corrections/eval labels included; nothing retained.
- **Privacy copy**: one source of truth (`docs/privacy.md`, written at
  build) rendered by both the privacy page and the permissions screen —
  drift structurally impossible; wording says "never store bodies" precisely
  (subjects ARE stored).
- **Failure-list hygiene**: `import_failures.reason` is categorical, never
  quoted email text — the no-content rule extends to stored reasons.

Glossary updated: deletion actions added to [CONTEXT.md](../../CONTEXT.md).
