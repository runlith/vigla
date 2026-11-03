---
id: 01a18680-7dc4-7cb1-9547-9c9ef3434492
title: "`svelte/compiler`"
ord: 2
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "index.ts"
      }
    ],
    "id": "svelte-compiler",
    "kind": "surface"
  }
edges:
  - kind: imports
    to: 01a18680-7dc2-71f8-be01-915833d45c4b
  - kind: imports
    to: 01a18680-7dc3-7684-af68-bcd6e92717c9
  - kind: imports
    to: 01a193e3-1ef2-7193-a47f-6b2e00b8694a
sources:
  - kind: dir
    ref: packages/svelte/src/compiler
---
`svelte/compiler` over the core: `parse` and `parseCss` answering upstream's AST, `compile` and `compileModule` with upstream's options and result shape, options validated with upstream's codes, output importing `svelte/internal/*`, and core and front-end diagnostics rethrown as upstream-shaped `CompileError`s.