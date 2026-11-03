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
      },
      {
        "at": "loss.ts"
      },
      {
        "at": "public.ts"
      },
      {
        "at": "carried.ts"
      },
      {
        "at": "front.ts"
      },
      {
        "at": "collector.ts"
      },
      {
        "at": "reads.ts"
      },
      {
        "at": "scheduler.ts"
      },
      {
        "at": "views.ts"
      },
      {
        "at": "units.ts"
      },
      {
        "at": "provenance.ts"
      },
      {
        "at": "leaving.ts"
      }
    ],
    "id": "reactivity",
    "kind": "product",
    "order": [
      [
        "graph.ts",
        "collector.ts",
        "tasks.ts",
        "errors.ts",
        "history.ts",
        "abort.ts",
        "tallies.ts"
      ],
      [
        "provenance.ts"
      ],
      [
        "edges.ts",
        "outgoing.ts"
      ],
      [
        "batch.ts"
      ],
      [
        "tracking.ts"
      ],
      [
        "carried.ts",
        "handlers.ts",
        "views.ts",
        "past.ts",
        "loss.ts"
      ],
      [
        "front.ts",
        "units.ts"
      ],
      [
        "effects.ts"
      ],
      [
        "leaving.ts",
        "owners.ts"
      ],
      [
        "reads.ts"
      ],
      [
        "eager.ts",
        "settle.ts",
        "held.ts"
      ],
      [
        "scheduler.ts"
      ],
      [
        "sources.ts",
        "fork.ts"
      ],
      [
        "async.ts",
        "proxy.ts",
        "external.ts",
        "latest.ts"
      ],
      [
        "public.ts"
      ],
      [
        "trace.ts"
      ]
    ]
  }
edges:
  - kind: imports
    to: 01a18680-7db9-7c10-b0ec-c0d1e0e72677
  - kind: imports-tests
    to: 01a18680-7dc2-71f8-be01-915833d45c4b
sources:
  - kind: dir
    ref: packages/vigla/src/runtime/reactivity
  - kind: file
    ref: packages/vigla/async.test.ts
  - kind: file
    ref: packages/vigla/commit.test.ts
  - kind: file
    ref: packages/vigla/leaving.test.ts
  - kind: file
    ref: packages/vigla/owners-server.test.ts
  - kind: file
    ref: packages/vigla/owners.test.ts
---
The runtime's bottom floor: sources, deriveds, the effect tree and the owners that stand for an application's lifetimes, the deep `$state` proxy, and the batch scheduler that turns writes into commits, holding a batch while its async work is pending. It knows no DOM: the blocks above it decide structure and register what changes at commit, and a boundary above it tells whether pending content stands in for its children.