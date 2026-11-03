---
id: 01a193be-2fec-7ef2-939c-6143483e81c9
title: Isolate reports of directly launched harness parts
ord: 20
tags: ["task"]
fields:
  {
    "holder": "tagma:01a18754-3a7f-7a8c-b16f-398394e4ee29",
    "status": "done"
  }
edges:
  - kind: discovered-from
    to: 01a187bd-e58e-7882-9c64-fae418924327
---
Make `resultsDir()` give a directly launched Kit or vite-plugin runner its own report directory when `VIGLA_RESULTS` is unset, so clearing that runner's output cannot delete reports of concurrent CLI runs. Preserve the explicit results-directory override and verify the default paths differ between processes.