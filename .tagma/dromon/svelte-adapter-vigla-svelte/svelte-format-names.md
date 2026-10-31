---
id: 01a193e3-1ef2-7193-a47f-6b2e00b8694a
title: Svelte format names
ord: 6
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "format.ts"
      }
    ],
    "id": "svelte-format",
    "kind": "substrate"
  }
edges:
  - kind: imports
    to: 01a18680-7dc2-71f8-be01-915833d45c4b
sources:
  - kind: dir
    ref: packages/svelte/src/shared
---
Names the adapter's serialized globals, element metadata and component CSS wrapper so its compiler and runtime agree without changing another tree's format.