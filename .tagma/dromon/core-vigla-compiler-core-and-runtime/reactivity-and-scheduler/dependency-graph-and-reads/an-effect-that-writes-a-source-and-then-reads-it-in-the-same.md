---
id: 01a1a183-4649-7b61-bae2-3e888eb298e9
title: An effect that writes a source and then reads it in the same run is stale when the run ends
ord: 10
tags: ["explanation"]
edges:
  - kind: discovered-from
    to: 01a1a13b-3d14-797b-84ee-1d533c70ae10
  - kind: relates
    to: 01a19ea4-a547-7190-810a-30c27d2855c5
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/tracking.ts
    symbol: writtenDuringRun
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/tracking.ts
    symbol: rereads
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: run
---
A write made during a run invalidates the live frames that already read the source ([[7d2855c5]]). A write made before the read reaches no frame and, on a first run, no reaction either, since the effect subscribes only when its run ends. Upstream 5.57.3 records such writes and checks them after the run (`untracked_writes`), and `schedules rerun when writing to signal before reading it` pins the outcome: an effect that assigns a fresh object to `$state.raw` and then reads it loops until `effect_update_depth_exceeded`.

So an effect's frame keeps the sources written while it is the innermost frame, `untrack` included; a derived's frame keeps none, since a derived may write only state local to its run. Once the run's dependencies are reconciled, it ends DIRTY if one of them is a written source, and MAYBE if a written source reaches it through deriveds, leaving the ordinary staleness check to decide whether a derived actually changed: `schedules rerun when writing to signal before reading it from derived` still runs once. The rerun is scheduled like any other — from content or effects, into the next batch. The upward walk from a written source visits each derived once; without that, a diamond of deriveds over the source makes it exponential (own `effect-shared-derived-cost`).
