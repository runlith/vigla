---
id: 01a1b93f-3d4c-7d83-bb93-773392723688
title: Run @runlith/layer's unit suite unchanged on Vigla with `svelte` resolved to `@vigla/svelte`
ord: 2
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a1852f-ba89-7089-9ac3-30e6011655b8
  - kind: relates
    to: 01a19dd4-9270-7e00-b175-0b70fd9b8e39
---
The first step of Tagma's stage 2 ([[011655b8]]): `@runlith/layer` is the real whole-application consumer of the core's primitives, and [[fd9b8e39]] was closed with no result recorded.

Read tagma's `packages/layer` without modifying it, resolve `svelte` to `@vigla/svelte`, and run its unit suite unchanged. Classify each red case by producer: a Vigla defect, layer relying on a Svelte internal, or a test pinning sync-mode timing, since Tagma runs Svelte with async off and Vigla is async-only. Vigla defects are fixed in the core with their own tests; layer-side findings become tasks in Tagma's graph. Record the red list and its classification here.
