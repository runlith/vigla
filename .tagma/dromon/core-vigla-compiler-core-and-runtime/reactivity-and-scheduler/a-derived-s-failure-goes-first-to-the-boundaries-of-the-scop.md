---
id: 01a19440-b700-71c0-b10f-1bcd6c6e56a2
title: A derived's failure goes first to the boundaries of the scope that declared it, then to its reader
ord: 14
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/tracking.ts
    symbol: refresh
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/tracking.ts
    symbol: settled
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/batch.ts
    symbol: due
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: dispose
---
An error thrown while a derived evaluates is offered first to the boundary chain of its owner — the effect it was declared under. When a boundary there takes it, the derived settles on `undefined` and readers see that until a dependency changes and it evaluates again (`error-boundary-10`, `-13`). When no boundary on the owner's chain takes it, the derived stays dirty and the error propagates out of whatever triggered the evaluation: a reaction reading the derived inside its own run fails through its own boundary, so every reader under a boundary catches it in turn (`error-boundary-19`), while a staleness check the scheduler makes propagates out of the flush uncaught (`error-boundary-12`). Upstream 5.57.3 behaves the same way: its derived offers the error to the declaring scope's boundaries before it rethrows to the reader.

The reaction whose run or staleness check threw is left clean, so the work the failed flush hands to the next batch does not include it and the failure is not replayed from every later microtask; it runs again when one of its dependencies changes. A derived with no owner keeps the error and rethrows it on each read, so it reaches the reading reaction's own failure path. An error thrown by a teardown, a derived re-evaluated inside one included, is delivered to the boundary of the effect being torn down, and a boundary whose own effect is being destroyed passes it to its parent, as upstream's teardown routing skips boundaries mid-teardown (`error-boundary-28`).
