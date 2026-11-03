---
id: 01a18792-e286-7043-a2c3-27e6df26f8e8
title: A reactive collection's lazily created per-key sources are local to a run only while that run is the one that created the collection
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/classes/local.ts
  - kind: file
    ref: packages/vigla/src/runtime/classes/map.ts
  - kind: file
    ref: packages/vigla/src/runtime/classes/set.ts
---
A collection's own sources (`version`, `size`, a date's time, a URL's fields, a spring's values) are created with the core's local-aware `state`, so a collection created inside a derived or effect can be written there without `state_unsafe_mutation` and without invalidating that run. Its per-key and per-value sources are created later, on first read of a key. One created during a later run of some other reaction must be an ordinary `source`: made local to that reaction, it would not become its dependency and the reaction would miss every later change of the key. So a per-key source copies the locality of the collection's `version` source at the moment it is created (`keyed`), which is true only inside the run that built the collection. This is what lets `new ReactiveSet([1])`, `has(1)`, `delete(1)` run inside one derived (`side-effect-derived-set`) while the same calls on a collection created outside throw.

The window readings' and `createSubscriber`'s sources are always ordinary `source`s: they are written from event listeners and teardowns, never inside the run that created them, and a reader in that run must still track them.