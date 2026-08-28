---
title: Privacy and deletion model
label: wayfinder:grilling
status: open
assignee:
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
