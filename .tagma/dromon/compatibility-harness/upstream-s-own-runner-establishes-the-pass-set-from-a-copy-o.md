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
  - kind: file
    ref: harness/reference.patch
  - kind: file
    ref: harness/src/suites.ts
---
The harness is valid only while it passes exactly the contract entries upstream's own runner passes in the reference configuration. Upstream's runner cannot run inside `.external`: it needs upstream's `pnpm install`, and it compiles every sample into `_output` beside it. So the clone is copied outside the repository, installed from its own lockfile with the pnpm version its `packageManager` names, and its test files run there with `SVELTE_NO_ASYNC` unset and a JSON reporter; `compare.ts` then sets that report beside the harness's JSON report from `targets/upstream` and fails on any contract entry passing on one side only.

Only `runtime_suite(true)` — runtime-runes, runtime-production, runtime-xhtml — forces runes and async itself. The hydration, server-side-rendering and runtime-browser runners (`test.ts` and `test-ssr.ts`) compile with the sample's own options, so `harness/reference.patch`, applied to the copy, adds `experimental.async: true` and forces `runes` unless the sample's `compileOptions` names it. Without it their pass sets are legacy mode's, not the reference configuration's. runtime-browser also needs the Chromium revision of upstream's Playwright, installed with `npx playwright install chromium` in the copy; the harness pins the same Playwright version so both runs use one browser build.

Each suite in `harness/src/suites.ts` names the upstream file and describe block its entries come from and how a title becomes `sample/variant`: hydration titles carry no variant, server-side-rendering's `sync`/`async` are `ssr`/`async-ssr`, `test-ssr.ts` is runtime-browser's `ssr` variant, the `custom-elements` describe of `runtime-browser/test.ts` is the custom-elements suite, and a unit-test file's entries are its describe path and title. Contract entries are read from the harness manifest, so a status change moves which entries the equality covers; converted entries are excluded because upstream's runner runs the unconverted originals.
