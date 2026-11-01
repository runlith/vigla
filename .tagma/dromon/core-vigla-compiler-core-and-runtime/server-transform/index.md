---
id: 01a18680-7dbe-7f74-92f0-3f8330c2730c
title: Server transform
ord: 5
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "index.ts"
      }
    ],
    "id": "server-transform",
    "kind": "product"
  }
edges:
  - kind: imports
    to: 01a18680-7db9-7c10-b0ec-c0d1e0e72677
  - kind: imports
    to: 01a18680-7dbb-7e28-818d-c9e31564a15f
  - kind: imports
    to: 01a18680-7dbc-7244-b1cc-b88469397a8d
  - kind: imports
    to: 01a1878f-918e-7939-ab43-8548688c49ca
sources:
  - kind: dir
    ref: packages/vigla/src/compiler/server
---
Generates server code from the analysis: a component becomes a function pushing HTML into an output, with the hydration markers the client reads, state kept as plain values and deriveds computed on first read.