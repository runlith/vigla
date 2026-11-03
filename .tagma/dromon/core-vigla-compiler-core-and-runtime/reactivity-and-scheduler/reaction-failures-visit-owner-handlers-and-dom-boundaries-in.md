---
id: 01a19440-b700-71c0-b10f-1bcd6c6e56a2
title: Reaction failures visit owner handlers and DOM boundaries in scope order
ord: 14
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/reads.ts
    symbol: refresh
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: dispose
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: fail
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/settle.ts
    symbol: due
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/reads.ts
    symbol: settled
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/sources.ts
    symbol: memo
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/leaving.ts
    symbol: cached
---
A reaction's failure walks outward through its effect scope, visiting the nearest registered owner handler or introduced DOM boundary first. Owner registrations are looked up at failure time, so a handle obtained after its children were created can still contain their failures. The latest live handler on an owner takes the error; removing it restores the previous registration. A handler that throws passes its replacement error outward, including any DOM boundary introduced on the same effect; a parentless `$effect.root` therefore keeps its copied declaring boundary. DOM boundary escalation resumes from its captured declaring owner, so an owner handler between two DOM boundaries is not bypassed by an inner boundary without recovery or by a later fallback failure. An error nothing takes leaves through the failing tree's front end ([[4ece65b4]]). Pending counts, visibility and inherited `Effect.boundary` pointers stay on their original paths; only failure delivery walks owner handlers.

A derived offers an evaluation failure through its declaration owner's scope first. If a handler takes it, a compiled derived reads as `undefined` until a dependency changes (`error-boundary-10`, `-13`): upstream pins one report per failure under a boundary. The public `derived` instead keeps the failure and rethrows it on every read until a dependency changes or an assignment publishes over it, so no reader receives a value its type forbids; a reading reaction under the same handler reaches it again as a failure of its own. An outgoing branch's historical view keeps the failure the same way, and a fork's assignment replaces it only when the fork commits. A derived computed in a batch's view, from values the committed world does not hold, throws to its reader without offering the failure to its owner: that failure is speculative until the batch commits, and the derived stays dirty for the committed world, whose evaluation then reaches the owner. Otherwise the error propagates through what triggered evaluation: a reading reaction uses its own failure path (`error-boundary-19`), while a scheduler staleness check skips handlers and boundaries and leaves through the tree's front end, which for a Svelte tree rethrows it out of the flush (`error-boundary-12`). An unowned derived, and a public one whose owner is disposed, retains the error for each reader's failure path.

The reaction whose run or staleness check threw stays clean until a dependency changes, so unfinished work handed to the next batch cannot replay the same failure indefinitely. Teardown errors, including a derived evaluated by cleanup, start at the effect being released. A destroyed owner handler is skipped, and a DOM boundary being destroyed escalates outward (`error-boundary-28`).
