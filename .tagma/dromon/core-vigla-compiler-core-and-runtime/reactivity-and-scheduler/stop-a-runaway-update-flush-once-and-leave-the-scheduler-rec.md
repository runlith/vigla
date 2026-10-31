---
id: 01a1940c-3b1f-77ec-8d17-b9e334d334dc
title: Stop a runaway update flush once and leave the scheduler recoverable
ord: 11
tags: ["task"]
fields:
  {
    "holder": "tagma:01a18754-3a91-778c-bdc8-cf0239ed279a",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fac9d5e3831
---
The unrecorded effect-loop-infinite hydrate case expects one effect_update_depth_exceeded event but the remainder worker reported none and then exhausted its roughly 4 GB heap, leaving 202 later variants unmeasured. Inspect the per-flush limit and queued automatic callbacks, stop the offending work without automatically restarting it, and preserve later healthy updates and normal error recovery. Use the exact case and focused recovery checks, with no heap increase or broad rerun.