---
id: 01a18619-654d-70b9-aa41-2a6f0358b0e5
title: Upstream's own runner establishes the pass set from a copy outside the repository
ord: 6
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fab49056597
sources:
  - kind: file
    ref: harness/src/compare.ts
---
The harness is valid only while it passes exactly the contract entries upstream's own runner passes in the reference configuration. Upstream's runner cannot run inside `.external`: it needs upstream's `pnpm install`, and it compiles every sample into `_output` beside it. So the clone is copied outside the repository, installed from its own lockfile with the pnpm version its `packageManager` names, and `vitest run packages/svelte/tests/runtime-runes/test.ts` runs there with `SVELTE_NO_ASYNC` unset and a JSON reporter; `compare.ts` then sets that report beside the harness's JSON report from `targets/upstream` and fails on any contract entry passing on one side only.

Contract entries are read from the harness manifest, so a status change moves which entries the equality covers; converted entries are excluded because upstream's runner runs the unconverted originals.