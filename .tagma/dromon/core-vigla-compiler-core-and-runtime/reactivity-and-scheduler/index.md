---
id: 01a18680-7dbf-7586-9429-a423940f08ed
title: Reactivity and scheduler
ord: 6
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "batch.ts"
      },
      {
        "at": "effects.ts"
      },
      {
        "at": "graph.ts"
      },
      {
        "at": "proxy.ts"
      },
      {
        "at": "sources.ts"
      },
      {
        "at": "tracking.ts"
      },
      {
        "at": "async.ts"
      },
      {
        "at": "fork.ts"
      },
      {
        "at": "owners.ts"
      },
      {
        "at": "tasks.ts"
      },
      {
        "at": "latest.ts"
      },
      {
        "at": "trace.ts"
      },
      {
        "at": "external.ts"
      },
      {
        "at": "abort.ts"
      }
    ],
    "id": "reactivity",
    "kind": "product"
  }
edges:
  - kind: imports
    to: 01a18680-7db9-7c10-b0ec-c0d1e0e72677
sources:
  - kind: dir
    ref: packages/vigla/src/runtime/reactivity
  - kind: file
    ref: packages/vigla/leaving.test.ts
---
The runtime's bottom floor: sources, deriveds, the effect tree and the owners that stand for an application's lifetimes, the deep `$state` proxy, and the batch scheduler that turns writes into commits, holding a batch while its async work is pending. It knows no DOM: the blocks above it decide structure and register what changes at commit, and a boundary above it tells whether pending content stands in for its children.