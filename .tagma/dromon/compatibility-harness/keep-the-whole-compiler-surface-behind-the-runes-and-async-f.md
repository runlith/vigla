---
id: 01a1a137-a388-7685-99d8-362aa1c9c6da
title: Keep the whole compiler surface behind the runes and async forcing hook
ord: 29
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1a103-2b70-7861-9b0f-32e38cb481b8",
    "status": "done"
  }
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9faa07b61535
  - kind: relates
    to: 01a18679-1a22-7cc3-8c23-93c4b0fa35f1
---
Under `harness/src/force.ts`, `require('svelte/compiler')` exposed only `compile` and `compileModule`: the ES wrapper's `export *` finds no names in upstream's UMD CommonJS bundle, so `VERSION` was undefined and `svelte-check` 4.7.7 failed on every `.svelte` file (`reading 'split'`) on both sides; `require` of the workspace's TypeScript compiler recursed into the wrapper. Serve a CommonJS compiler patched in place and import an ES one under a separate query, so every consumer gets the full module with forcing applied.