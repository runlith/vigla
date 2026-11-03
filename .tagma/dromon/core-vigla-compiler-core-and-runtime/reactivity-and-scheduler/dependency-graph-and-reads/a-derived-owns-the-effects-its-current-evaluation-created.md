---
id: 01a193e9-7ab5-7fb7-9769-3bba63aa7bf5
title: A derived owns the effects its current evaluation created
ord: 7
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a193e7-b8d8-74a9-9509-eecedc7f7aeb
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/context.ts
    symbol: userEffect
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: create
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: freeze
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/graph.ts
    symbol: Derived
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: destroyEffects
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/edges.ts
    symbol: freezeUnread
---
An attached effect created directly while a derived evaluates belongs to that evaluation, while retaining the declaration owner's context and place in the effect tree. Recomputing or disconnecting the derived destroys those effects when its work is replaced; otherwise a cached expression can retain a subscription to a value it no longer returns. An evaluation whose result stays in a batch's view replaces nothing at once: the committed evaluation keeps its effects until that batch commits, and the view's effects take their place then, or end if the batch is discarded ([[389a8e9e]]). An explicit root belongs to its chosen parent, or stands independently with no parent; the caller's derived never adopts it. A component's `$effect` created while a derived evaluates during the component's initialisation is created at once rather than at the end of initialisation, as upstream defers only outside a reaction: deferred, no derived would own it.

When the last reaction reading a derived unsubscribes — rerun without it, destroyed, or a derived reading it disconnected — the derived keeps its value and freezes the user and pre effects of its evaluation that hold resources: their children and teardowns run and they leave their dependencies. The next reaction to subscribe reschedules them, and they run again over the same cached value, so an object a dependencyless derived built once keeps its state across a hidden reader (`effect-inside-derived-frozen`). A derived whose own abort signal was aborted this way is dirty and evaluates afresh when next read. A derived read by another derived counts as read even when nothing reads that one: deriveds stay subscribed while their owner lives, so freezing does not cascade through unread deriveds as upstream 5.57.3's disconnection does.