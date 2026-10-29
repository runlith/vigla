---
id: 01a18752-ff03-7988-bdb3-d50dea2ce0c6
title: Rule Svelte's unit tests and the signals suite in the manifest, converted or covered
ord: 6
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
Svelte's `packages/svelte/src/**/*.test.ts` and `tests/signals` drive internals. Each test is converted to public API where every assertion has a public counterpart, and then passes on `targets/upstream`; otherwise it is covered, its reason naming the Dromon module and behaviour whose own test will assert it.