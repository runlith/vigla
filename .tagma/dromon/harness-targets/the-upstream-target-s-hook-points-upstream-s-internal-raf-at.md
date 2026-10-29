---
id: 01a18616-2e51-70b4-b262-0ddd7a95adcd
title: The upstream target's hook points upstream's internal raf at the harness clock
ord: 1
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fab49056597
sources:
  - kind: file
    ref: targets/upstream/fresh.ts
---
Under vitest's jsdom environment `esm-env` resolves `BROWSER` to false — in upstream's own test runs as in ours — so upstream 5.57.3's `raf.tick` is a no-op and `raf.now` reads `Date.now`: the runtime reads neither `requestAnimationFrame` nor `performance.now`. Faking globals alone leaves every `tick`-driven transition frozen (10 runtime-runes entries failed that way). The hook therefore sets `raf.tick` once to the global `requestAnimationFrame` the clock fakes, and `raf.now` to the clock's own time. Making `BROWSER` true instead would also flip `svelte/reactivity/window` and the server's crypto path away from what upstream's runs exercise.

`performance.now` stays the real clock, as in upstream's runner: `async-stale-read-many-sources` times its own work with it against a budget, and a frozen global would make that assertion pass whatever the runtime costs.

The hook also does, between samples, what upstream's runner does through internals: it deletes the hydratable store `__svelte.h`, resets the `$props.id()` counter, clears `raf.tasks` and the scheduler's batches, and fails a sample that leaves hydration or the server context set. Without clearing `raf.tasks`, a task left by an unmounted sample keeps the set non-empty, and the next sample's `loop()` never requests a frame.