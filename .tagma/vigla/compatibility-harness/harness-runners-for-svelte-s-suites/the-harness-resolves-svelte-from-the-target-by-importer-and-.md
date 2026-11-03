---
id: 01a18616-32e8-741c-8e0d-7c8f17e3fb6a
title: The harness resolves svelte from the target by importer and runs the target's package through Vite
ord: 1
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fab49056597
sources:
  - kind: file
    ref: harness/src/resolve.ts
  - kind: file
    ref: harness/src/runtime/suite.ts
  - kind: file
    ref: harness/src/samples.ts
  - kind: file
    ref: harness/src/vitest.ts
---
The harness package declares no `svelte`: every `svelte` and `svelte/*` import — runner, samples, compiled output — resolves through the target's installed package, so one run can never mix two implementations. Compiled server output gets the `default` export conditions and everything else `browser`, as upstream's test config resolves them. `vigla` and `vigla/*` resolve the same way wherever the target installs `vigla`, since own samples import the core by that name and its root entry is a server no-op variant under `default`. The package is found in the target's `node_modules` rather than through `require.resolve`, because `vigla` exports no `./package.json`. The target's package is inlined into Vite's transform rather than externalized to Node: externalized, its `esm-env` import would resolve under Node's conditions, giving `DEV` false where upstream's runs have `DEV` true.

Samples are copied per test process into the target's `.work` and compiled into `_output` beside their `_config.js`, as upstream does, because a sample may import its own compiled output by a path relative to its config; the per-process copy keeps two runs, of one target or two, from overwriting each other.

The copy keeps upstream's layout, `packages/svelte/tests/<suite>/samples/<sample>` under the run directory, because compiled output depends on the path: the hydration, server-side-rendering and runtime-browser runners compile without `rootDir`, so the compiler makes the filename relative to `process.cwd()`, upstream's repository root, and the default CSS hash is a hash of that relative path. `_expected_head.html` files such as server-side-rendering's `css` pin `svelte-e9omc` literally, and HTML comparison normalizes hashes only in `class` attributes. Those suites, and css and sourcemaps, which upstream compiles the same way, therefore compile with the run directory as `rootDir`; the runtime suites keep the sample directory, as upstream's `runtime_suite` passes it.

A sample's other bare imports — sourcemaps configs use `magic-string`, `source-map`, `typescript` and `@jridgewell/trace-mapping` — resolve from the harness package when the run directory cannot resolve them, because the target's tree carries only the target. The harness pins them to the versions upstream's lockfile installs, as it pins upstream's Playwright.