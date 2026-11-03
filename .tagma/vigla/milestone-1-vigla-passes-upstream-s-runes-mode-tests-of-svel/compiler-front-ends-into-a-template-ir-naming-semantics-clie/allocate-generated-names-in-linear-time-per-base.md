---
id: 01a19ead-1718-7d79-a3ea-bdf25773a9bd
title: Allocate generated names in linear time per base
ord: 6
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e32-fb25-7109-9e5d-e26d8c51fa54",
    "status": "done"
  }
edges:
  - kind: discovered-from
    to: 01a19e94-3fb8-7d5b-a72d-3163908a7579
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fad9ca8ebb2
sources:
  - kind: symbol
    ref: packages/vigla/src/compiler/ir/estree.ts
    symbol: Names
---
`compile_elements` ran 2.0–2.9× upstream in single runs. A CPU profile of that one benchmark puts 50.7% of Vigla's self time in `Names.unique` (`compiler/ir/estree.ts`), reached from client `navigate` once per node variable. The method probes `base`, `base_1`, … from the start on every call, so a template with N nodes sharing a hint (`input`, `textarea`, `section`, `text`) costs O(N²) string builds and set lookups. Upstream's `Scope.generate` caches the next counter per preferred name for the same reason. Cache it per base in `Names`, keeping the produced names identical, and prove it with a before/after single-benchmark ratio.

Measured on 2026-11-03, 12 × Apple M2 Max, Node 26.8.1, load average 9–14, three alternating runs per target, back to back: `compile_elements` upstream/Vigla medians 689.06/1361.81 ms (ratio 1.98) before, 497.50/421.27 ms (0.85) after. The profiled child's total CPU time fell from 27.6 s to 4.8 s; `unique` went from 50.7% to 1.3% of self time and `navigate` left the top entries. Provisional samples, not the parity medians.