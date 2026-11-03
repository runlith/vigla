---
id: 01a1a11d-7152-7095-88ce-9ac696ede4c0
title: Ship `@vigla/svelte`'s compiler as a CommonJS `compiler/index.js`
ord: 5
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1a103-2b70-7861-9b0f-32e38cb481b8",
    "status": "done"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faa07b61535
---
`svelte-check` loads `svelte/compiler` with a synchronous `require`, so the packed adapter needs upstream's root `compiler/` directory: a self-contained CommonJS bundle of `src/compiler/index.ts` under `{"type": "commonjs"}`, reached through a `require` condition on `./compiler` that only the published manifest carries, since the bundle exists only once built.