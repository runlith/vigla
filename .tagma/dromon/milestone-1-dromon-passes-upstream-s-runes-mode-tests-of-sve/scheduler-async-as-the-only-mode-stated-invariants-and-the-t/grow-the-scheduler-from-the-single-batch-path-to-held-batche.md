---
id: 01a18752-ff03-7988-bdb3-d50e5e2ef4a9
title: Grow the scheduler from the single-batch path to held batches, rebase, settled and user effects
ord: 2
tags: ["task"]
fields:
  {
    "holder": "tagma:01a18754-3a91-778c-bdc8-cf0239ed279a",
    "status": "done"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fac9d5e3831
---
The reactivity module runs only one batch today. Build the rest of [[aa9fb09b]] and the spec: held batches and their views, merging, rebase, `settled()`, `tick`, `fork`, `untrack`, user and pre effects, async deriveds and pending work. Each invariant gets a test of Dromon's own; each listed trap becomes a plain component in project `own`, run on upstream 5.57.3 with its result recorded.