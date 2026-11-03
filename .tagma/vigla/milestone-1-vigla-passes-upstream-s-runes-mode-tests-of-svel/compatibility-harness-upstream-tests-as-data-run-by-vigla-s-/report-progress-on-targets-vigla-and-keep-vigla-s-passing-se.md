---
id: 01a18752-ff03-7988-bdb3-d50c19ff4ec0
title: Report progress on targets/vigla and keep Vigla's passing set as its test suite
ord: 5
tags: ["task"]
fields:
  {
    "holder": "tagma:01a18754-3a7f-7a8c-b16f-398394e4ee29",
    "status": "done"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fab49056597
---
Build what the spec's report and passing set ask: the progress report against Vigla, the recorded passing set per suite with the command that records newly passing entries, the run of the recorded set alone and the run of one suite or sample. Then run `harness:upstream` once as one command and fix what only that combined run breaks. Every core agent records entries through it, so it lands first.

Combined run, 2026-10-29, load average up to ~28: equal to upstream's runner in every Svelte suite, vite-plugin mode and Kit report but one, basics' `data-sveltekit-preload-code` under server-side route resolution in dev, which failed all three attempts and passed alone at load ~8. The harness changes nothing on its path: project conversions are shared with the reference, and the gate fixture runs before the body. The test waits a fixed 100 ms for a preload that route resolution delays with an extra request, and its `networkidle` wait returns at once. The shallow-route scroll test passed in every mode, needing one retry in the route-resolution build.