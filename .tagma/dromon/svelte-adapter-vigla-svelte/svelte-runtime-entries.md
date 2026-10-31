---
id: 01a18680-7dc5-7a26-b604-0af48b752f02
title: "`svelte` runtime entries"
ord: 3
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "index.ts"
      },
      {
        "at": "server.ts"
      },
      {
        "at": "internal/client.ts"
      },
      {
        "at": "internal/server.ts"
      },
      {
        "at": "index-server.ts"
      },
      {
        "at": "store-client.ts"
      },
      {
        "at": "store-server.ts"
      }
    ],
    "id": "svelte-entries",
    "kind": "surface"
  }
edges:
  - kind: imports
    to: 01a18680-7dc2-71f8-be01-915833d45c4b
  - kind: imports
    to: 01a193e3-1ef2-7193-a47f-6b2e00b8694a
sources:
  - kind: dir
    ref: packages/svelte/src/entries
  - kind: file
    ref: packages/svelte/package.json
  - kind: file
    ref: packages/svelte/tsconfig.json
---
The runtime entries Svelte's world imports as `svelte`, `svelte/server`, `svelte/reactivity`, `svelte/reactivity/window`, `svelte/motion` and `svelte/internal/*`, each re-exporting the matching `vigla` entry — `svelte/reactivity` renaming the core's `Reactive*` classes to upstream's `Svelte*` names — so code reaching the runtime by either name shares one instance, and installing the reporter that prints runtime diagnostics in upstream's form. `svelte/store` owns the subscription-based store API and its client and server projections of reactive state. Its `package.json` carries the adapter's name, its 5.x version and its `exports` keys.