---
id: 01a19e65-500e-7822-bece-d795b5ca984d
title: Fix owner lifetimes and complete the public core primitives
ord: 20
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a19de0-59b2-7950-bf1d-a0b137f29ce1
---
From the core architecture review (thread 01a19e5c-5db1-7327-97fe-fb30444bc188), scenarios 8 and 9 of [[37f29ce1]]: `Owner.start` must not hold the current batch — it counts toward settlement only, and holding a batch becomes a separate explicit primitive (D1); a service outlives everything created after it under the same owner while component siblings keep their order (D3); disposing an owner that holds a mount removes its DOM and delegated listeners through the same path as `unmount` (D4); `onDestroy` outside an owner is a diagnostic, not a silent no-op (D6); server owners track their work without the client scheduler and an owner-scoped settlement waits for it on both sides (D8). Complete the public surface so the adapter and libraries need no internals: an effect root keeping the caller's context, a pre/synchronous effect, an async resource with its pending count, `snapshot`, eager latest values, `owner.onDispose`, `owner.root(fn)`, an owner-scoped `settled` (O1, O3). Stop leaking internals through public types: factory-only `Owner`, `effect()` returning a dispose function on both sides, the compiled `$store` protocol off the public `external` (D9). Move the adapter's internal imports for these onto the public entries.