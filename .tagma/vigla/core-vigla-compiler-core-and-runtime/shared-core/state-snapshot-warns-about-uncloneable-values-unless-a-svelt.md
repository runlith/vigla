---
id: 01a1a183-4d0e-73cb-9eec-6979ab21f4f9
title: "`$state.snapshot` warns about uncloneable values unless a `svelte-ignore` covers the call; inspection copies silently"
ord: 4
tags: ["explanation"]
edges:
  - kind: discovered-from
    to: 01a1a13b-3db9-7630-af03-159f45d79a75
  - kind: relates
    to: 01a18775-9009-78c2-8a23-23e1e2d9ed4c
sources:
  - kind: file
    ref: packages/vigla/src/compiler/analysis/ignoring.ts
  - kind: file
    ref: packages/vigla/src/shared/clone.ts
---
Client and server share one clone. It reads a `$state` proxy through its traps and needs nothing of the reactivity floor, so the server gets the same copies of maps, sets, dates and `toJSON` results, and the originals of what `structuredClone` refuses, where its own bare `structuredClone` used to throw on a function.

In DEV a snapshot collects the path of every value `structuredClone` refused, which it returns as the original, and warns `state_snapshot_uncloneable` once per call, with upstream's message: the single value, or the first ten paths, seven and a count past ten. `$inspect` and `$inspect.trace` copy silently, as upstream passes its skip flag. So does a `$state.snapshot` call that a `svelte-ignore state_snapshot_uncloneable` covers: both code generators ask analysis whether a node carrying that code spans the call, in script and template alike, and pass `true` as the second argument (`state-snapshot-uncloneable-ignored`). An `EventTarget` is returned as it is without being tried or reported, as upstream exempts it. A `toJSON` result stands for its instance from the start of its copy, so a result that refers back to the instance copies as a cycle rather than calling `toJSON` without end. A silent copy collects no paths at all; upstream's skipped warning still pushes them into a module-level array that is never cleared.
