---
id: 01a1944d-e2f4-7c0b-bdea-8c1bf59ebb65
title: Static deployment adapter
ord: 15
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "src/index.ts"
      }
    ],
    "id": "adapter-static"
  }
edges:
  - kind: imports
    to: 01a193f1-4d97-7589-b3a8-69aa6c365dd0
sources:
  - kind: dir
    ref: packages/adapter-static
---
A static deployment for Kit sites whose routes are prerendered, with an optional application-shell fallback. It owns output directories and detected hosting configuration; generating pages and the fallback remains the Builder's responsibility.