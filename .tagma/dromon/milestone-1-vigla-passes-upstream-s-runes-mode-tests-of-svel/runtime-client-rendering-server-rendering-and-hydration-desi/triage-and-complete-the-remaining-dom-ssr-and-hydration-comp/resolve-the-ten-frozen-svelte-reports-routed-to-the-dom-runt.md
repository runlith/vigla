---
id: 01a19574-64a8-7ee5-8a9b-8d5d4fab4d64
title: Resolve the ten frozen Svelte reports routed to the DOM runtime
ord: 3
tags: ["task"]
fields:
  {
    "holder": "tagma:01a193e1-e009-75fe-ac94-1ff32a3298c8",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a19454-63c8-70c2-96a1-509e5ed381c8
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
---
Ten of the frozen reports [[5ed381c8]] verified stay with the DOM runtime:
- #17395 and #16139, as the unrecorded own/runtime progress samples `option-spread-null` and `props-own-spread`;
- #17379: a forced-GC retained detached input keeps the listener's payload on both targets;
- #16168: typing orders effect and handler differently on Chromium and Firefox; the order to keep is settled with the scheduler;
- transitions #10252, #6668, #4389, #15627;
- the affected-engine checks of #6914 and #4712, still selected because their engines are unavailable here.

Measurements stand in [[2e546434]]. Fix each producer with a public regression red on 5.57.3, or remove the report from the selection there with fork-base evidence.