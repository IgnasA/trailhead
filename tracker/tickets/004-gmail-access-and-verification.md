---
title: Gmail access and OAuth verification constraints
label: wayfinder:research
status: open
assignee: research agent (this session)
blocked-by: []
---

## Question

What does it actually take to read a user's flight emails with
`gmail.readonly`, and what does Google's verification regime mean for an MVP?
Specifically:

1. **Verification**: `gmail.readonly` is a restricted scope. What are the
   current (2026) requirements — OAuth verification, CASA/security assessment,
   cost, timeline? What are the hard caps for an *unverified* app (test-user
   limits, token expiry, consent-screen warnings), i.e. how far can an MVP get
   before verification is unavoidable? Is there a narrower scope
   (e.g. `gmail.metadata` — insufficient? — or restricted-scope alternatives)
   that changes the calculus?
2. **API mechanics**: search query operators for finding flight emails
   (from:, subject:, category:), `messages.list`/`messages.get` formats
   (metadata vs full), batching, quota units and per-user rate limits for a
   ~1,200-message scan, and incremental sync via `historyId` for re-imports.
3. **Data handling obligations**: Google's Limited Use policy as it applies to
   storing extracted flight records + message id/subject/hash while never
   persisting bodies (the wireframes' 1b/1h screens make specific promises —
   flag anything in policy that contradicts them).

Primary sources: Google Workspace / Gmail API docs and the OAuth verification
help pages. Resolution: findings file in the repo per the research skill, plus
a short answer here — the key numbers (caps, cost, timeline) and any wireframe
promise that policy contradicts.
