---
id: 01a1d182-0ee8-7764-87de-9f0a62408495
title: "An effect record carries only what most effects use: booleans share one flags word and pending-work units live beside the record"
ord: 58
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/graph.ts
    symbol: Effect
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/units.ts
    symbol: holdUnit
---
Every effect pays for every field of the one shape all effects share, and a list row makes two of them, so a field only some effects need costs every row. The booleans — destroyed, inert, pending, running, forked, async, scope, preserved — are bits of `flags`; the units of pending work an effect holds sit in a side table that `UNITS` marks, since few effects hold any and destruction checks the bit instead of a field. `kind` stays a field of its own: readers test it on deriveds and plain sources alike, and a load from a shape lacking the property would make those hot reads polymorphic ([[0eca7d2b]]).