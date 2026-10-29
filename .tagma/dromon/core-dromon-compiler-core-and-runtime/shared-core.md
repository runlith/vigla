---
id: 01a18680-7db9-7c10-b0ec-c0d1e0e72677
title: Shared core
ord: 1
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "escape.ts"
      },
      {
        "at": "markers.ts"
      },
      {
        "at": "html.ts"
      }
    ],
    "id": "shared",
    "kind": "substrate"
  }
sources:
  - kind: dir
    ref: packages/dromon/src/shared
---
The bottom of the core, below both the compiler and the runtime: what both sides must agree on byte for byte — HTML escaping, the hydration markers server output writes and hydration reads, and HTML knowledge such as void elements. It holds no state and loads no package, so the runtime imports it without carrying compiler code.