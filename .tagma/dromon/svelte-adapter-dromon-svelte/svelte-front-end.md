---
id: 01a18680-7dc3-7684-af68-bcd6e92717c9
title: "`.svelte` front end"
ord: 1
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "index.ts"
      }
    ],
    "id": "svelte-front-end"
  }
edges:
  - kind: imports
    to: 01a18680-7dc2-71f8-be01-915833d45c4b
sources:
  - kind: dir
    ref: packages/svelte/src/front
---
Fills the core's port for `.svelte`: parses component source into upstream's AST, lowers it to the template IR, resolves global runes in `.svelte` and `.svelte.js`, and reports syntax-bound errors with upstream's codes. It parses only the subset the core supports yet; anything else is an `unsupported` error.