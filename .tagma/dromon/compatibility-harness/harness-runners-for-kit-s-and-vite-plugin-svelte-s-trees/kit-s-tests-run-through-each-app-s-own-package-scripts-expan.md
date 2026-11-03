---
id: 01a186ae-3fd5-74c0-a6ef-0500dc17f0fd
title: Kit's tests run through each app's own package scripts, expanded step by step on the reference and the harness alike
ord: 2
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a18679-19d9-77b5-9372-29e928467398
sources:
  - kind: dir
    ref: harness/src/kit
  - kind: file
    ref: harness/src/store.ts
---
Upstream runs Kit's apps through package scripts that chain `pnpm` calls, environment prefixes and several test commands; options runs `playwright test` three times under different `PATHS_*` values, options-2 twice with and without a service worker. `steps.ts` expands a script the way pnpm would and gives each `playwright test` or `vitest run` its own JSON report, labelled `<script>-<n>`. That label, with the Playwright project for browser tests, is an entry's variant, so the same test under two environments is two entries. The reference runner and the harness run the same expansion, the reference in upstream's copy and the harness in the target's work tree. A failing step does not stop the ones after it, unlike `&&`, so both sides report every step.

The runs cover each app's `test:dev`, `test:build` and the `server-side-route-resolution` and `cross-platform` variants it has. `svelte-async` is left out because async is forced in every run, which makes it the same run as `test:dev` and `test:build`. Prerendering's and build-errors' cross-platform scripts only rerun `test:build`. Upstream's CI runs adapter-bun's `test:platform` a second time with `COMPILE=true`, against the server compiled into a Bun executable. The harness writes it as the script name `COMPILE=true test:platform`: the leading assignments are the script's environment, and its label is `compile-true-test-platform-<n>`.

Tests and Playwright's web servers call `pnpm` themselves, so the target's `kit` package pins pnpm 12.11.2, the version Kit's `packageManager` names, and the root manifest trusts its install script. Without that script the binary stays a shebang-less `sh` shim, and Node's `execFile('pnpm')` fails with `ENOEXEC`.

Each app copy's `node_modules` links the packages its `package.json` declares, from the target's install, with `file:` packages copied into a store as pnpm injects them. Kit's build names a font by its `node_modules/<package>` path only when the app's own `node_modules` holds that package, and options' preload hook filters on that name. Inside the repository pnpm finds the root manifest, runs its dependency check before every script and fails on the copies' `catalog:` specs, so the harness turns that check off (`pnpm_config_verify_deps_before_run=false`). Playwright retries each test twice on both sides through `KIT_E2E_RETRIES`, as upstream's CI does; that keeps one-off timing failures out of the equality.

Copied Kit app tests take `test` from Kit's `test/utils.js`. The harness copy of that file adds an automatic fixture that rules each test from the manifest; the reference copy carries only the shared change from the `chrome` channel to Playwright's bundled Chromium. Own app fixtures use the same public gate in an automatic Playwright fixture without requiring upstream's layout globals or startup marker. The adapters' Playwright tests import `test` from `@playwright/test` directly and run without a gate, which their all-contract manifests allow.

Every `vitest run` step is gated too: vitest has no flag that adds a setup file, so the runner hands vitest a wrapper config that merges a `beforeEach` gate into the step's own config — the `-c`/`--config` one, else vitest's default names under the step's `--root` — and the gate's setup file lives in the app copy so it imports the app's `vitest`. Without it build-errors' `difference` ran and failed. The reference runs the steps unwrapped.
