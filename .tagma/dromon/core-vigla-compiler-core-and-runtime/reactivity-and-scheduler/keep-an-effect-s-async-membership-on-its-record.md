---
id: 01a19f85-b28c-7277-a1a1-b724c342720e
title: Keep an effect's async membership on its record
ord: 54
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e8e-1ebc-75c8-bf20-40d6cc82a51d",
    "status": "in_work"
  }
edges:
  - kind: relates
    to: 01a195a3-567a-7025-b99c-22982a93bdf4
  - kind: relates
    to: 01a19f4b-ca38-7994-ba82-53c242b00569
---
Whether an effect runs an async expression was kept in the `asynchronous` WeakSet in graph.ts, added once when `asyncDerived` creates the effect. `run` looked it up on every effect run inside a batch, and `retain`, `mark`, `stale` and `held` did so for blocks. A WeakSet lookup hashes the effect on each call. The membership never changes after creation, so it becomes the effect's `async` field, as [[2a93bdf4]] asks of state read on hot paths.