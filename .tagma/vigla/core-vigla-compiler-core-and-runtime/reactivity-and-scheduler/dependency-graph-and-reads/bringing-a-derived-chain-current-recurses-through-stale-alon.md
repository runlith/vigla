---
id: 01a19f90-bb6f-71a1-825f-e3d0cc8e6c62
title: Bringing a derived chain current recurses through stale alone, and a run settles inline in track
ord: 9
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a19f4b-ca38-7994-ba82-53c242b00569
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/reads.ts
    symbol: recompute
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/reads.ts
    symbol: stale
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/tracking.ts
    symbol: readDirty
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/tracking.ts
    symbol: track
---
With no view active, `stale` brings a dependency current by checking it with `stale` itself, then calling `recompute` only when that answers true. A chain of N deriveds is therefore checked N frames deep, as upstream's `is_dirty` does. Calling `refresh(dep)` there was rejected: it checks staleness again before recomputing, so it doubled the depth, with `refresh`'s larger frame at every level. `refresh` stays the entry point for reads and for the view branch, where the view's `affected` check has to run between the staleness check and the recomputation.

`track` settles a run inline in its `finally`: invalidation, `reconcile`, `retain`, `rv` and status. Only the scan for reads left dirty stays in `readDirty`, and it is needed only when a view is active or something was marked during the run. Moving all of this into a separate settling function holding that scan made every derived evaluation and effect run measurably slower in V8, even though the function was small.