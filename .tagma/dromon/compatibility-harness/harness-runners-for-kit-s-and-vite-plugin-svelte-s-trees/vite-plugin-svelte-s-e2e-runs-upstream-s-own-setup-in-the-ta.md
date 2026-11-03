---
id: 01a18679-1a4c-771c-84a2-4eb789c1b9c1
title: vite-plugin-svelte's e2e runs upstream's own setup in the target's tree, ruled per test by a beforeEach gate
ord: 4
tags: ["explanation"]
sources:
  - kind: dir
    ref: harness/src/vite-plugin
  - kind: file
    ref: harness/src/gate.ts
---
The plugin's e2e specs mostly call `test` and `describe` as vitest globals, so a facade over the `vitest` import cannot rule them. `gate.ts`, the first setup file, rules each test in a `beforeEach` by its file, describe path and mode and skips those whose status does not run. A test file none of whose entries run is left out of the run: the covered unit specs import the plugin's internal sources, which the copy does not carry.

Upstream's `vitestSetup.ts`, `vitestGlobalSetup.ts`, `e2e-server.js` and `testUtils.ts` run as copied, since they use public API only, in a work tree under the target's `vite-plugin` package, whose `node_modules` hold the plugin's locked toolchain. Each project's `file:` test packages are copied into a store under the work tree's `node_modules/.local` and linked from the project, as pnpm injects them. Two things break without that layout: Vite treats a dependency whose real path lies outside `node_modules` as linked source, which changes pre-bundling, and kit-node's hermetic-build test fails on any output path naming the project.

Package scripts run through `bun run --silent`, because the specs count every stderr line of a server as an error. The browser server's endpoint is a fixed file in the OS temp directory, so the reference and the harness cannot run at the same time. `CI=1` gives both the same timeouts; because it also preserves `temp`, the reference copy's `temp` is removed before each mode.
