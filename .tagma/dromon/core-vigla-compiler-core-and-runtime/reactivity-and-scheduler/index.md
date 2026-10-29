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
      }
    ],
    "id": "reactivity",
    "kind": "product"
  }
sources:
  - kind: dir
    ref: packages/vigla/src/runtime/reactivity
---
The runtime's bottom floor: sources, deriveds, the effect tree and the owners that stand for an application's lifetimes, the deep `$state` proxy, and the batch scheduler that turns writes into commits, holding a batch while its async work is pending. It knows no DOM: the blocks above it decide structure and register what changes at commit, and a boundary above it tells whether pending content stands in for its children.