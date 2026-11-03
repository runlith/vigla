---
id: 01a195a3-567a-7025-b99c-22982a93bdf4
title: Derived and effect records put kind, status and their edges first
ord: 4
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: create
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/sources.ts
    symbol: derived
---
V8 lays out an object literal's fields in the order written, and the marking walk and staleness checks read `kind` and `status` of every reaction they visit, then its `reactions` or `deps`. With `status` at the end, a derived (152 bytes) or effect (192 bytes) needed a second cache line per visit beside the header's. Keeping the fields every visit reads directly after `kind` puts them on the header's line. Measured on Node 26.8: the walk's share of `kairo_mux_unowned` fell from 13.9% to 12.3% from the reorder alone. A field added to either record goes after these, unless every visit reads it too.

State that every run or staleness check consults belongs on the record rather than in a weak table keyed by the reaction. The values a run read under a batch's view (`captured`, null for a run outside views) used to live in such tables. Every run, view or not, then paid a lookup and two deletions, and every MAYBE check paid one more lookup.