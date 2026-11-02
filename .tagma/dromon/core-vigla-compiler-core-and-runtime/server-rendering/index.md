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
      },
      {
        "at": "attributes.ts"
      },
      {
        "at": "context.ts"
      },
      {
        "at": "hydration.ts"
      },
      {
        "at": "external.ts"
      },
      {
        "at": "snippet.ts"
      },
      {
        "at": "placement.ts"
      }
    ],
    "id": "ssr",
    "kind": "product"
  }
edges:
  - kind: imports
    to: 01a18680-7db9-7c10-b0ec-c0d1e0e72677
  - kind: imports
    to: 01a18680-7dbf-7586-9429-a423940f08ed
sources:
  - kind: dir
    ref: packages/vigla/src/runtime/server
---
Server rendering: the output compiled server code pushes HTML into, `render()` with the result Kit reads, the component context a render keeps, and the helpers compiled server code calls, such as attribute serialization.