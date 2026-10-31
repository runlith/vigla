---
id: 01a19440-b700-71c0-b10f-1bcd6c6e56a2
title: A derived's failure is delivered to the boundaries of the scope that declared it
ord: 14
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/tracking.ts
    symbol: refresh
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/tracking.ts
    symbol: settled
---
An error thrown while a derived evaluates is delivered once, at evaluation, through the boundary chain of its owner — the effect it was declared under — and readers then see `undefined` until a dependency changes and it evaluates again. Upstream 5.57.3 routes by the declaring scope too: a derived declared outside a boundary and read inside it is not caught by that boundary (`error-boundary-12`), while one created inside it is (`error-boundary-10`). With no boundary on the owner's chain the error propagates, uncaught, out of whatever triggered the evaluation; because the derived already holds `undefined`, a reader the failed flush hands to the next batch runs once more and settles instead of replaying the failure from every later microtask. A derived with no owner keeps the error and rethrows it on each read, so it reaches the reading reaction's own failure path.