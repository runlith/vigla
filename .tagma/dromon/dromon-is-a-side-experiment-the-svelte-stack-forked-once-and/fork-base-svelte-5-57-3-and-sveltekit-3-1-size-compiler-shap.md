---
id: 01a1852f-ba89-7089-9ac3-30e788b9f5b3
title: "Fork base Svelte 5.57.3 and SvelteKit 3.1: size, compiler shape, tooling coupling and sync mode's status"
ord: 1
tags: ["research"]
fields:
  {
    "source": {
      "name": "Svelte, SvelteKit, vite-plugin-svelte, svelte-check",
      "ref": "npm tarballs svelte@5.57.3, @sveltejs/kit@3.1.0, @sveltejs/vite-plugin-svelte@7.3.1; svelte-check@4.7.7 as installed in runlith/tagma; npm registry and svelte.dev docs, 2026-10-29"
    }
  }
---
The fork base: the latest releases on 2026-10-29 — Svelte 5.57.3, SvelteKit 3.1.0 (3.0.0 shipped 2026-10-01), vite-plugin-svelte 7.3.1.

**Size** (JS and TS lines of the published `src`, declarations and tests excluded): Svelte 64,609 — compiler 40,175, client runtime 16,117, server runtime 2,360; the reactive core (`internal/client/reactivity/*.js` and `runtime.js`) 5,094, of which the batch scheduler `batch.js` 1,441. SvelteKit 39,574 (210 JS, 25 TS and 3 Svelte files). vite-plugin-svelte 3,719. About 108k lines in all before tooling; language tools are bundled into `svelte-check` and were not counted. Upstream types its JS with JSDoc: about 5.8k `@param`/`@returns`/`@type` tags in Svelte.

**Compiler shape.** 62 analysis visitors, 54 client and 35 server transform visitors, each keyed on a Svelte AST node type (`IfBlock`, `EachBlock`, `BindDirective`, …).

**Tooling coupling** (`svelte-check` 4.7.7, the latest release). It resolves the compiler from the installed package named `svelte` (`getPackageInfo('svelte')`, `require('svelte/compiler')`) and ships a tsgo diagnostics provider. Its bundled svelte2tsx special-cases the runes `$state`, `$derived`, `$props`, `$props.id` and `$bindable` and the template node types it knows (`IfBlock`, `EachBlock`, `KeyBlock`, `AwaitBlock`, `SnippetBlock`, `RenderTag`, `ConstTag`); a new node type gets no TSX. Runes are typed by ambient declarations in the package types (`declare function $state<T>(initial: T): T`).

**Peers.** SvelteKit 3.1.0 requires Svelte `^5.57.1`, Vite `^8.0.12`, TypeScript `^6.0.0`, vite-plugin-svelte `^7.0.0` and Node `>=22.17`. vite-plugin-svelte 7.3.1 requires Svelte `^5.46.4` and Vite 8.

**SvelteKit 3 already drops legacy** ([migration guide](https://svelte.dev/docs/kit/migrating-to-sveltekit-3)): `svelte.config.js` is no longer read — configuration goes to the `sveltekit` Vite plugin; `$app/stores`, `$service-worker` and the `base`, `assets` and `resolveRoute` exports of `$app/paths` are removed; `$lib` is no longer generated, replaced by `#lib` in `package.json` `imports`; `$app/environment` becomes `$app/env`; an async `handleError` needs `compilerOptions.experimental.async`; remote functions stay experimental.

**Sync mode's status.** `legacy_updates` in `batch.js` belongs to legacy (non-runes) mode and stores — `@deprecated when we get rid of legacy mode and stores` — yet every write during traversal goes through it, runes included. Two TODOs expect non-async mode to go: `batch.js:444` ("this will likely regress when non-async mode is removed") and `compiler/phases/2-analyze/visitors/DeclarationTag.js:63` ("once non-async and non-runes mode is gone"). The await-expressions documentation says only that "the experimental flag will be removed in Svelte 6"; that async becomes the default rests on one docs pull request, not read.

**Cadence.** 344 stable 5.x releases from 5.0.0 (2024-10-19) to 5.57.3 (2026-10-26), 20 of them in the last six months; no 6.x version published.

**Not established.** The layout of upstream's own test suite (runtime samples written as `.svelte` components, validator and parser fixtures) is recalled, not read; SvelteKit's tests are not in its published package.
