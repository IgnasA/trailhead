---
title: Extraction and import pipeline design
label: wayfinder:grilling
status: open
assignee:
blocked-by: [003, 004, 005]
---

## Question

Design the import pipeline behind frame 1c. The wireframe fixes the stage list
— connect → search mailbox → skip cached → extract flights → deduplicate →
reconstruct trips → build history — and several properties: every stage has a
real counter (no fake easing), per-item failures never abort the job and
surface as a reviewable list, the job is resumable and batched ("batch 3 of
7"), the user can close the tab and get an email on completion, and re-imports
are fast because of the hash cache.

Grill to decide: the deterministic-vs-LLM split per the extraction-landscape
findings (which layers run in what order; when is a case "ambiguous" per §19),
which LLM and structured-output approach for the ambiguous tier, cost controls
and budget per import, batch sizing against Gmail quotas, how progress state is
stored and streamed to the page, retry/resume semantics, dedupe/merge rules
that produce `merged_from`/`confidence`, and how the unparsed-email list and
user corrections feed the eval dataset.

Blocked by [Stack and hosting decision](003-stack-and-hosting.md) (where jobs
run), [Gmail access and OAuth verification constraints](004-gmail-access-and-verification.md)
(quotas, sync mechanics), and [Flight email extraction landscape](005-flight-email-extraction-landscape.md)
(what to build on).
