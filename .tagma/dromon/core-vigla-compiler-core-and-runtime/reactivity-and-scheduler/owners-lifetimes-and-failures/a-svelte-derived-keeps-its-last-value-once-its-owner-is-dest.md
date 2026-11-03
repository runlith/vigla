---
id: 01a1a183-3e6c-7217-b049-5443eae5acd3
title: A Svelte `$derived` keeps its last value once its owner is destroyed; every other derived evaluates afresh
ord: 7
tags: ["explanation"]
edges:
  - kind: discovered-from
    to: 01a1a13b-3d14-797b-84ee-1d533c70ae10
  - kind: relates
    to: 01a1877e-fd98-7ad3-8502-952177d1c74f
  - kind: relates
    to: 01a19440-b700-71c0-b10f-1bcd6c6e56a2
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/reads.ts
    symbol: inert
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: disconnect
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/sources.ts
    symbol: lapsingDerived
  - kind: file
    ref: packages/svelte/src/entries/internal/client.ts
---
Upstream 5.57.3 stops evaluating a derived whose parent effect is destroyed: a read returns the cached value and warns `derived_inert` (signals `derived whose original parent effect has been destroyed no longer updates`), so a torn-down component's expression never runs against state its guards no longer protect. That restricts the primitive, so it is a policy the derived carries (`lapses`), selected only by the Svelte projection: `svelte/internal/client` exports `lapsingDerived` as the `derived` its compiled code calls. Every other derived — the core's compiled `$derived`, runtime-internal ones such as a prop's, the public `derived` — evaluates afresh after its owner ended, so a service or a handler reads current values (`owners.test.ts`).

A lapsing derived stops only once it holds a value: one never evaluated still evaluates, and so does a read during a teardown, which must see what it releases, as upstream's `is_destroying_effect` exempts it. Destroying the owner unsubscribes the derived like any other, so it keeps the inputs its last evaluation read: while none of them changed, a read returns the value silently; once one has, the read returns it with the warning. Bringing those inputs current checks each lapsing derived once per read, so a diamond of them under one destroyed owner stays linear.
