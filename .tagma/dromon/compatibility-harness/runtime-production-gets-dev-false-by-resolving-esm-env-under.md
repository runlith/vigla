---
id: 01a1863b-ef68-732f-9afb-66601350085c
title: runtime-production gets DEV false by resolving esm-env under the production condition
ord: 7
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fab49056597
sources:
  - kind: symbol
    ref: harness/src/resolve.ts
    symbol: production
  - kind: file
    ref: harness/src/vitest.ts
---
Upstream's runtime-production runner mocks `esm-env` to `DEV: false`; the harness reaches the same value through the package's export conditions, as [[49056597]] requires, which takes two steps. Vitest drops the `production` condition outside production mode whatever `resolve.conditions` says, so the production project resolves `esm-env` and its subpaths itself, picking from esm-env's `exports` with `production` and the server conditions. And `esm-env` must be inlined into Vite's transform for that project: externalized, its `index.js` re-imports `esm-env/development` through Node, which lands on `dev-fallback.js` and reads `NODE_ENV`, `test` under vitest, giving `DEV` true.

The `esm-env` resolved is the one the target's `svelte` loads, found through its dependency chain: upstream's at the package itself, Dromon's under `dromon`, which `@dromon/svelte` depends on.

The condition set leaves `browser` out, so `BROWSER` stays false and `NODE` true, as under the mock; only `DEV` changes.
