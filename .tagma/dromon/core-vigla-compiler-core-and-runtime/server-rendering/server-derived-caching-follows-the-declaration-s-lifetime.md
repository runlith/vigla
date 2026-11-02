---
id: 01a19431-bfe2-7927-a896-026c18978c18
title: Server derived caching follows the declaration's lifetime
ord: 5
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/server/render.ts
    symbol: derived
  - kind: symbol
    ref: packages/vigla/src/runtime/server/context.ts
    symbol: isRendering
  - kind: symbol
    ref: packages/vigla/src/runtime/server/context.ts
    symbol: memo
---
A module's compiled derived can outlive many requests, so it re-evaluates on each read rather than retaining the first request's value. Created during rendering, it keeps a lazy cache for that instance. Its compiled assignment protocol uses a non-nullish override; a nullish assignment clears that override.

The public `derived` value instead follows an explicit declaration owner, including a service or request outside rendering: it evaluates lazily under that owner and its captured declaration layer, retaining its result because server cells publish no reactive invalidations. The declaration layer matters because server components share a render owner: first reading a parent's memo inside a child must not capture the child's context, and a child's exported memo keeps its context after the component has returned. An unowned declaration evaluates under each reader's current scope without caching a request's context. Its assignable `current` accepts nullish overrides too, matching the public client value rather than the compiler's callable protocol. Server owners supply cancellation and failure routing without making server effects run.
