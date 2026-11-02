---
id: 01a19dd4-9270-7e00-b175-0b70fd9b8e39
title: Run @runlith/layer on Vigla without Svelte internals or Tagma's Svelte patch
ord: 15
tags: ["task"]
fields:
  {
    "status": "closed"
  }
edges:
  - kind: relates
    to: 01a18776-8e37-7bdc-93a5-7dad4786b347
---
`@runlith/layer` (tagma `packages/layer`) is Tagma's existing service graph — keys, layers, scopes with lifetimes, Svelte and SvelteKit bindings — and the real whole-application consumer the core is designed for. On Svelte it needs `without_reactive_context` from `svelte/internal/client`, exported only by Tagma's `patches/svelte@5.57.0.patch`, whose other hunks change template cloning to `document.importNode` and the ordering of block effects a teardown dirties while a batch processes.

First measure layer's existing unit suite unchanged with `svelte` resolved to `@vigla/svelte`, reading tagma's sources without modifying them; Tagma runs Svelte outside async mode and Vigla is async-only, so each red case is classified by producer and by whether it pins sync-mode timing. Then express the binding's needs through public `vigla` primitives — detached owner runs and roots for the reactive-context escape — so no internal import and no patch hunk remains necessary, fixing any missing primitive in the core. A change to layer itself is Tagma's work and adapts its `@fpm/layer` twin.