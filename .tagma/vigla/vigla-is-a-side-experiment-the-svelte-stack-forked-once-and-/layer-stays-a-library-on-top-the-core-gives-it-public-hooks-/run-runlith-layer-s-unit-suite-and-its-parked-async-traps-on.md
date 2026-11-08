---
id: 01a1b93f-3d4c-7d83-bb93-773392723688
title: Run @runlith/layer's unit suite and its parked async traps on Vigla's Svelte adapter
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

Read tagma's `packages/layer`, resolve `svelte` to `@vigla/svelte`, and remove only `experimental.async: false` from layer's `vite.config.ts` and `svelte.config.js`, which `@vigla/svelte` refuses. Run its unit suite and the layer traps parked in tagma's `patches/svelte@5.57.0.off/` — session handoff, deferred tree, time travel, rebase and branch removal, the async-mode cases of patch hunks 05, 06, 08 and 09. Classify each red case by producer: a Vigla defect, layer relying on a Svelte internal, or a test pinning sync-mode timing. Vigla defects are fixed in the core with their own tests; layer-side findings become tasks in Tagma's graph. Record the red list and its classification here.

This proves today's Svelte binding on Vigla's adapter, where `without_reactive_context` maps to an unowned root; the owner-based binding of [[57917054]] is a later step.
