---
id: 01a19440-b700-71c0-b10f-1bcd6c6e56a2
title: Reaction failures visit owner handlers and DOM boundaries in scope order
ord: 14
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/tracking.ts
    symbol: settled
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: dispose
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/deriveds.ts
    symbol: refresh
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/settle.ts
    symbol: due
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: fail
---
A reaction's failure walks outward through its effect scope, visiting the nearest registered owner handler or introduced DOM boundary first. Owner registrations are looked up at failure time, so a handle obtained after its children were created can still contain their failures. The latest live handler on an owner takes the error; removing it restores the previous registration. A handler that throws passes its replacement error outward. DOM boundary escalation resumes from its captured declaring owner, so an owner handler between two DOM boundaries is not bypassed by an inner boundary without recovery or by a later fallback failure. Unhandled errors retain their existing propagation. Pending counts, visibility and inherited `Effect.boundary` pointers stay on their original paths; only failure delivery walks owner handlers.

A derived offers an evaluation failure through its declaration owner's scope first. If a handler takes it, the derived reads as `undefined` until a dependency changes (`error-boundary-10`, `-13`). Otherwise the error propagates through what triggered evaluation: a reading reaction uses its own failure path (`error-boundary-19`), while scheduler staleness checks propagate out of the flush (`error-boundary-12`). An unowned derived retains the error for each reader's failure path.

The reaction whose run or staleness check threw stays clean until a dependency changes, so unfinished work handed to the next batch cannot replay the same failure indefinitely. Teardown errors, including a derived evaluated by cleanup, start at the effect being released. A destroyed owner handler is skipped, and a DOM boundary being destroyed escalates outward (`error-boundary-28`).
