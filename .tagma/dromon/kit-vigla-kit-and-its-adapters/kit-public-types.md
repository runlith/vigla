---
id: 01a193f1-4d97-7589-b3a8-69aa6c365dd0
title: Kit public types
ord: 1
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "."
      }
    ],
    "id": "kit-types"
  }
edges:
  - kind: imports
    to: 01a187ca-e656-7569-8564-ac0fabdaf506
sources:
  - kind: dir
    ref: packages/kit/src/types
  - kind: file
    ref: packages/kit/types/index.d.ts
---
The type surface Kit's users and Kit's own modules write against — configuration, request events, `load`, hooks, actions, remote functions, the adapter `Builder` — as type-only TypeScript, so every module states its contracts in one vocabulary and the published declarations follow from the same source. It holds no runtime code.