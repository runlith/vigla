---
id: 01a1878f-918e-7939-ab43-8548688c49ca
title: Component CSS scoping
ord: 12
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "index.ts"
      }
    ],
    "id": "css",
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
    ref: packages/vigla/src/compiler/css
---
Keeps a component's styles to the component: it reads the unit's style sheet against the template IR, rejects `:global` and nesting forms that cannot be scoped, finds which selectors can match an element of this component and warns about those that cannot, marks the elements that must carry the component's scoping class, and writes the sheet with that class added, `:global` removed, unused rules commented out or dropped and keyframes renamed. Generation reads its scoping to add the class to elements and to inject the sheet; the caller names the class, so the core holds no adapter's naming.