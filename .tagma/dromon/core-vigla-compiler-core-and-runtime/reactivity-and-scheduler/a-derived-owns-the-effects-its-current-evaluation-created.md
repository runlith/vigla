---
id: 01a193e9-7ab5-7fb7-9769-3bba63aa7bf5
title: A derived owns the effects its current evaluation created
ord: 9
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a193e7-b8d8-74a9-9509-eecedc7f7aeb
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/graph.ts
    symbol: Derived
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/tracking.ts
    symbol: destroyEffects
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: create
---
An attached effect created directly while a derived evaluates belongs to that evaluation, while retaining the declaration owner's context and place in the effect tree. Recomputing or disconnecting the derived destroys those effects before replacing its work; otherwise a cached expression can retain a subscription to a value it no longer returns. An explicit detached root keeps its independent lifetime.