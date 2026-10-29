---
id: 01a18616-32e8-741c-8e0d-7c8f17e3fb6a
title: The harness resolves svelte from the target by importer and runs the target's package through Vite
ord: 4
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fab49056597
sources:
  - kind: file
    ref: harness/src/resolve.ts
  - kind: file
    ref: harness/src/vitest.ts
---
The harness package declares no `svelte`: every `svelte` and `svelte/*` import — runner, samples, compiled output — resolves through the target's installed package, so one run can never mix two implementations. Compiled server output gets the `default` export conditions and everything else `browser`, as upstream's test config resolves them. The target's package is inlined into Vite's transform rather than externalized to Node: externalized, its `esm-env` import would resolve under Node's conditions, giving `DEV` false where upstream's runs have `DEV` true.

Samples are copied per test process into the target's `.work` and compiled into `_output` beside their `_config.js`, as upstream does, because a sample may import its own compiled output by a path relative to its config; the per-process copy keeps two runs, of one target or two, from overwriting each other.