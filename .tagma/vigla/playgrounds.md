---
id: 01a1a2eb-b08e-755d-af85-89b92defff2c
title: Playgrounds
ord: 26
tags: ["module"]
fields:
  {
    "id": "playgrounds",
    "kind": "product"
  }
edges:
  - kind: imports
    to: 01a18680-7dc2-71f8-be01-915833d45c4b
  - kind: imports
    to: 01a18680-7dc5-7a26-b604-0af48b752f02
  - kind: imports
    to: 01a1a3c1-fa06-7690-8926-459c574270c3
sources:
  - kind: dir
    ref: playgrounds
---
Two runnable demo apps an operator opens to see the product work: `playgrounds/svelte` is an ordinary Svelte 5 app whose `svelte` and `@sveltejs/vite-plugin-svelte` imports resolve to `@vigla/svelte` and `@vigla/vite-plugin-svelte` by workspace alias, and `playgrounds/vigla` is plain TypeScript over the `vigla` core with no component compiler. Each runs with `vite` from its own directory; no test or build reads them.