---
title: Google Cloud OAuth setup
label: wayfinder:task
status: open
assignee:
blocked-by: []
---

## Question

Stand up the Google side so development against real Gmail can start
(graduated from the fog by
[Gmail access and OAuth verification constraints](004-gmail-access-and-verification.md)):
create the Google Cloud project, enable the Gmail API, configure the OAuth
consent screen in **Testing mode** (per the resolved research: 100 named test
users, 7-day token expiry — dogfood here indefinitely; never publish
unverified), request the `gmail.readonly` scope, add the user (and any
testers) as test users, and create the OAuth client ID/secret for the app.

HITL: needs the user's Google account. The wizard skill fits this ticket —
generate a walkthrough once the stack decision fixes the redirect URLs.
Resolve by recording the project id, where the client credentials live
(never the secrets themselves), and the configured redirect URIs. Full
verification + CASA is a separate, later effort — out of this ticket.
