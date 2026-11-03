---
id: 01a1a13b-3d14-797b-84ee-1d533c70ae10
title: Pass the three failing converted signals tests on derived ownership, inert deriveds and raw-state reruns
ord: 55
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1a140-bed8-7b7b-98cd-f482092a5c0d",
    "status": "done"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
---
Entries of `svelte/signals`, converted, unrecorded (`harness/samples/svelte/signals/test.ts`):
- `signals > creating effects within a derived correctly handles ownership (runes mode)` — `expected [ 'outer', +0 ] to deeply equal [ 'outer', +0, 'inner', +0 ]`: an `$effect` created inside a `$derived.by` read in `flushSync` never runs. See [[63aa7bf5]] (a derived owns the effects its current evaluation created).
- `signals > derived whose original parent effect has been destroyed no longer updates (runes mode)` — `expected 4 to equal 2`: after the `$effect.root` holding the derived's parent `$effect.pre` is destroyed, writing its source still recomputes the derived, and upstream's `derived_inert` warning is expected.
- `signals > schedules rerun when writing to signal before reading it (runes mode)` — `expected false to equal true`: an `$effect` that reassigns `$state.raw` then reads it must end in `effect_update_depth_exceeded` from `flushSync`; Vigla settles. Upstream's second test of the same title is `test.skip`, so the entry is judged by this one.

Evidence: full run of 2026-11-03 (`full-run-3`), unchanged at HEAD 61432896.