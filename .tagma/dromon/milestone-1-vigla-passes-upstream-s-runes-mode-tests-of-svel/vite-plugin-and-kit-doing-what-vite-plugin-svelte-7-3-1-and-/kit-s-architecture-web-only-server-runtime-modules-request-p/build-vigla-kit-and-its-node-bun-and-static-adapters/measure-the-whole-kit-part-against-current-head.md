---
id: 01a19e32-1cfa-773c-84ce-4a3383b96456
title: Measure the whole Kit part against current HEAD
ord: 2
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e32-fad7-75aa-94e3-8d719e01745c",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a193ed-396f-73b6-bbe3-bad77aa7b0be
---
One full run of the harness Kit part with the same scope as production run b9400416 (976 entries), at a HEAD carrying the Node, Bun and static adapters, the prerender fixes and today's core changes. Classify every entry as first-pass, retry-only, failed, explicit skip, unexecuted or missing, cluster failures by their first error and producing module, and list entries that pass but are unrecorded with their producer eligibility. No source or passing-row change; the clusters become fix tasks.