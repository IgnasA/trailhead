---
title: Design sync access
label: wayfinder:task
status: open
assignee:
blocked-by: []
---

## Question

Run `/design-login` once in an interactive Claude Code session on this machine
so the `DesignSync` tool can read the Claude Design project
(<https://claude.ai/design/p/a303c989-2415-46c7-82c3-5f5dae0da407>) directly.
The initial import (see [design/README.md](../../design/README.md)) had to be
smuggled through a browser session because this authorization was missing;
future design iterations (hi-fi passes, new frames) should sync cleanly.

HITL: the login is an interactive OAuth-style flow only the user can complete.
Resolve by noting that DesignSync reads the project successfully.
