---
id: 01a195a1-9319-7597-8201-66d90eca7d2b
title: The mark walk tests a reaction's kind itself, not through isDerived
ord: 4
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/scheduler.ts
    symbol: mark
---
`isDerived` is shared by readers of sources and reactions alike, so its inlined property check carries the map of plain sources too. When that check dominates the `status` writes in the marking walk, TurboFan infers the receiver may be a source, finds no `status` field there, and compiles both writes as generic store calls, which spill and reload around every visited reaction. Testing `kind` on the walk's own `Derived | Effect` value keeps the inferred maps to the two reaction shapes, so the writes stay inline field stores. Measured on Node 26.8 (V8 TurboFan): the walk's share of `kairo_mux_unowned` fell from about 17.5% to 13.9%. The same hazard applies to any hot loop that writes a field after calling a helper whose feedback includes shapes lacking that field.