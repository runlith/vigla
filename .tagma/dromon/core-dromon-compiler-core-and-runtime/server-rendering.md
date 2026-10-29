---
id: 01a18680-7dc1-7c56-81a9-8c98fa24c1dc
title: Server rendering
ord: 8
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "render.ts"
      }
    ],
    "id": "ssr",
    "kind": "product"
  }
edges:
  - kind: imports
    to: 01a18680-7db9-7c10-b0ec-c0d1e0e72677
sources:
  - kind: dir
    ref: packages/dromon/src/runtime/server
---
Server rendering: the output compiled server code pushes HTML into, `render()` with the result Kit reads, and the helpers compiled server code calls.