---
id: 01a19e67-05e0-787f-ab6f-554d9146b775
title: Type a handled derived failure honestly
ord: 29
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a19de0-59b2-7950-bf1d-a0b137f29ce1
---
From the core architecture review (O7): when an owner's handler or a boundary takes a derived's failure, the derived settles on `undefined` while its public type is `T` (`runtime/reactivity/deriveds.ts` around 54). Decide the public contract for the core `derived` — keep the failure and rethrow on read, or expose the failed state — so readers cannot receive a value their type forbids; compiled `$derived` keeps upstream's pinned `undefined` behaviour in the adapter.