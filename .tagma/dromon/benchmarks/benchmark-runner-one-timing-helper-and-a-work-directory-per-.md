---
id: 01a19ed3-7cee-7b89-831e-68590f627a8c
title: "Benchmark runner: one timing helper, and a work directory per run"
ord: 2
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e32-fb25-7109-9e5d-e26d8c51fa54",
    "status": "done"
  }
edges:
  - kind: discovered-from
    to: 01a19e94-3fb8-7d5b-a72d-3163908a7579
sources:
  - kind: file
    ref: benchmarks/src/prepare.ts
  - kind: file
    ref: benchmarks/shared/time.js
---
Two runner defects met while closing the compiler and SSR losses. The timing half of `reactivity/util.svelte.js` (forced collection, GC observer, fastest of N) was duplicated in the plain `shared/time.js` that the compiler and SSR suites use; it moves there, and the runes helper keeps only its reactive fixtures. Every run also prepared the same `targets/<target>/.work/bench` and wiped it first, so a run started by another session on the checkout broke the one in progress: a child failed with `ERR_MODULE_NOT_FOUND` for `.work/bench/reactivity/util.svelte.js`. Each run now prepares `.work/bench-<pid>` and removes it when it exits.