---
id: 01a18680-7dbc-7244-b1cc-b88469397a8d
title: Analysis
ord: 3
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "index.ts"
      },
      {
        "at": "validate/index.ts"
      },
      {
        "at": "validate/report.ts"
      }
    ],
    "id": "analysis",
    "kind": "product"
  }
edges:
  - kind: imports
    to: 01a18680-7db9-7c10-b0ec-c0d1e0e72677
  - kind: imports
    to: 01a18680-7dbb-7e28-818d-c9e31564a15f
sources:
  - kind: dir
    ref: packages/dromon/src/compiler/analysis
---
Judges a unit's validity with upstream's diagnostics, then decides what its code means before any output exists: scopes and bindings, which bindings are reactive and how — state, raw state, derived, props, each item and index — which identifiers reference them, which template expressions can change, each element's namespace, and the template's whitespace as HTML keeps it. Client and server generation read only its result, so both agree on meaning; a construct it does not support yet fails here with an `unsupported` diagnostic.