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
      }
    ],
    "id": "reactivity",
    "kind": "product"
  }
sources:
  - kind: dir
    ref: packages/dromon/src/runtime/reactivity
---
The runtime's bottom floor: sources, deriveds, the effect tree, the deep `$state` proxy and the batch scheduler that turns writes into commits. It knows no DOM: the blocks above it decide structure and register what changes at commit.