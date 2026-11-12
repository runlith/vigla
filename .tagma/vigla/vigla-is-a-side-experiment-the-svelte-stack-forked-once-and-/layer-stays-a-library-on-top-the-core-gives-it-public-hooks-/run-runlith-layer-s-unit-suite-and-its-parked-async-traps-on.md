---
id: 01a1b93f-3d4c-7d83-bb93-773392723688
title: Run @runlith/layer's unit suite and its parked async traps on Vigla's Svelte adapter
ord: 2
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1b8c8-2a1b-7b1c-a07e-d8bb06298c96",
    "status": "done"
  }
edges:
  - kind: relates
    to: 01a1852f-ba89-7089-9ac3-30e6011655b8
  - kind: relates
    to: 01a19dd4-9270-7e00-b175-0b70fd9b8e39
---
The first step of Tagma's stage 2 ([[011655b8]]): `@runlith/layer` is the real whole-application consumer of the core's primitives, and [[fd9b8e39]] was closed with no result recorded.

Read tagma's `packages/layer`, resolve `svelte` to `@vigla/svelte`, and remove only `experimental.async: false` from layer's `vite.config.ts` and `svelte.config.js`, which `@vigla/svelte` refuses. Run its unit suite and the layer traps parked in tagma's `patches/svelte@5.57.0.off/` — session handoff, deferred tree, time travel, rebase and branch removal, the async-mode cases of patch hunks 05, 06, 08 and 09. Classify each red case by producer: a Vigla defect, layer relying on a Svelte internal, or a test pinning sync-mode timing. Vigla defects are fixed in the core with their own tests; layer-side findings become tasks in Tagma's graph. Record the red list and its classification here.

This proves today's Svelte binding on Vigla's adapter, where `without_reactive_context` maps to an unowned root; the owner-based binding of [[57917054]] is a later step.

**Result, 2026-11-12.** Run on branch `vigla` of Tagma, `svelte` resolved to `@vigla/svelte` 5.57.4 and the async flag removed from layer's two configs; Kit stayed 2.70.

- Unit suite as it stood: 225 tests, one red — `src/svelte/recycle.test.ts`, where unmounting closed the app's scope before the component using its service was destroyed.
- Producer: a Vigla defect, two parts. A `$effect` in a module function compiled to an effect created at once, where a component's own compiles to one created at the end of initialisation; and `onDestroy` registered at once. Both therefore stood before the template's effects and were torn down before the component's children, where upstream releases them last. Fixed in `f27ae90358` with the own sample `component-teardown-after-children`, green on upstream first. That fix deferred `onDestroy` to the end of initialisation, as upstream does, and so lost it for a component whose script throws; the release harness caught it on `hydration-error-recovery`, and `7420e5a462` registers it at once and only moves it behind its siblings (`component-failed-init-teardown`).
- No red came from layer relying on a Svelte internal or from a test pinning sync-mode timing.
- The parked traps, moved back into `packages/layer/src/svelte`: session handoff (2 tests), deferred tree (3), time travel (26), rebase (1), branch removal (1) — all green. The whole suite with them is 249 tests in 40 files, green on the published `@vigla/svelte` 5.57.5 and `vigla` 0.2.1; Tagma's branch `vigla` carries the switch in `ab66145ea5`.

Not covered by this run: query's `single.fork` and the app's `RenderingPorts` traps, still parked, and layer's import of `without_reactive_context` from `svelte/internal/client`, which the owner-based binding removes.
