---
id: 01a18680-7dbd-7ae0-84ae-0bacb1135202
title: Client transform
ord: 4
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "index.ts"
      }
    ],
    "id": "client-transform",
    "kind": "product"
  }
edges:
  - kind: imports
    to: 01a18680-7db9-7c10-b0ec-c0d1e0e72677
  - kind: imports
    to: 01a18680-7dbb-7e28-818d-c9e31564a15f
  - kind: imports
    to: 01a18680-7dbc-7244-b1cc-b88469397a8d
sources:
  - kind: dir
    ref: packages/dromon/src/compiler/client
---
Generates a component's and a module's client code from the analysis: HTML templates cloned per instance, DOM navigation, template effects, blocks and listeners, and scripts rewritten so rune-declared bindings are read and written through signals. The caller names the runtime the output imports, so `.svelte` output imports `svelte/internal/client` and native output `dromon/internal/client`.