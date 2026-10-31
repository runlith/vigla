---
id: 01a193e1-785c-7977-9c5b-f0395f19a69e
title: Give @vigla/svelte svelte/store and $store subscriptions over the core's public reactivity
ord: 5
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
---
Stores are kept in milestone 1 ([[658ccea4]]): `svelte/store` (`writable`, `readable`, `derived`, `get`, `readonly`, `toStore`, `fromStore`), `$store` subscriptions in components, upstream's `tests/store`, the runes samples using stores, and the vite-plugin e2e projects `hmr`, `build-watch` and `kit-node` that need them. The API is the adapter's; anything it needs of the core is a general primitive with no Svelte name.