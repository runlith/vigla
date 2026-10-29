---
id: 01a185b6-09f2-796e-90b2-9fa8019de65b
title: "Upstream tests at the fork base: suites, harness, runes and legacy coverage, what tooling reads"
ord: 9
tags: ["research"]
fields:
  {
    "source": {
      "name": "Svelte, SvelteKit, vite-plugin-svelte test suites; svelte-check",
      "ref": ".external clones sveltejs/svelte@23bb146 (svelte@5.57.3), sveltejs/kit@73bf98c (@sveltejs/kit@3.1.0), sveltejs/vite-plugin-svelte@54c6efe (7.3.1); svelte-check@4.7.7 in runlith/tagma node_modules; read 2026-10-29"
    }
  }
---
**Svelte** (`packages/svelte/tests`, vitest; jsdom for the runtime suites, Playwright Chromium for `runtime-browser`). Samples per suite: runtime-legacy 1209, runtime-runes 1098, validator 337, css 184, compiler-errors 150, server-side-rendering 132, hydration 86, parser-legacy 84, migrate 78, print 51, runtime-browser 39 plus `custom-elements-samples`, snapshot 34, sourcemaps 29, parser-modern 28, preprocess 19, runtime-xhtml 13, runtime-production 6. `motion`, `signals` and `store` are single test files; `types` holds type tests.

**Runtime harness.** A runtime sample is a directory with `_config.js` and `main.svelte`. The shared runner (`runtime-legacy/shared.ts`; `runtime-runes/test.ts` calls it with runes on) compiles each sample for client and server and runs the variants `dom`, `hydrate`, `ssr` and `async-ssr`, narrowed per sample by `mode`, `skip_mode`, `skip_async` and `skip_no_async`. Async mode is on by default: `async_mode = process.env.SVELTE_NO_ASYNC !== 'true'` in `tests/helpers.js`. In runtime-runes, 287 sample names start with `async-`, 23 configs set `skip_no_async`, 2 set `skip_async` (`const-tag-boundary-deprecated-usage`, `untrack-own-deriveds`). The runner reaches internals: `clear` from `src/internal/client/reactivity/batch.js`, `hydrating` from `src/internal/client/dom/hydration.js`, `ssr_context` from `src/internal/server/context.js`, and `createClassComponent` from `svelte/legacy`.

**Runes and legacy in the samples.** No suite outside runtime-runes forces `runes: true` in a sample config. Samples whose `.svelte` files use a rune: hydration 21 of 86, server-side-rendering 21 of 132, css 3 of 184, validator 31, compiler-errors 31, snapshot 14, runtime-browser 15, runtime-xhtml 7, runtime-production 4, sourcemaps 1; the rest are written in syntax valid in legacy mode. 144 runtime-runes samples contain `export let`, `$:`, `<slot` or an `on:` directive in some file, and 39 use stores; both counts are text matches, not inspected one by one.

**Legacy constructs in runes mode.** Compile errors in runes mode: `export let`, `$$props`, `$$restProps`, `$:`, importing `beforeUpdate` or `afterUpdate`. Deprecation warnings in runes mode: `on:` directives, `<slot>`, `<svelte:component>`, `<svelte:self>`, `context="module"`, the `accessors` and `immutable` options. `createEventDispatcher` is marked `@deprecated` in its JSDoc.

**What upstream tooling reads.** svelte2tsx in `svelte-check` 4.7.7 calls the compiler's `parse()` without `modern: true` and reads `parsed.html`: it consumes the legacy-format AST, the format the `parser-legacy` suite pins.

**SvelteKit** (`packages/kit`): 75 unit spec files beside the source, run by `vitest.kit.config.js`; integration apps in `test/apps` (async, basics, dev-only, embed, hash-based-routing, no-csr, no-ssr, options, options-2, options-3, prerendered-app-error-pages, read-file-test, writes) plus `test/build-errors` and `test/prerendering`, with 17 Playwright test files run in dev and in build, and `test:svelte-async:*` scripts running them under Svelte's async mode. 191 of the 766 `.svelte` files in the apps contain `$app/stores`, `svelte/store`, `export let` or `<slot` (text matches). Kit typechecks with `@typescript/native`.

**vite-plugin-svelte**: unit specs in `packages/vite-plugin-svelte/__tests__` (compile, id, preprocess, sourcemaps, svelte-version) and 35 entries in `packages/e2e-tests`, among them `inspector-kit`, `inspector-vite`, `kit-node`, `kit-async` and `hmr`.

**Benchmarks**: `benchmarking/benchmarks` holds `compiler`, `reactivity` and `ssr` suites.

**Not established**: which samples upstream passes with `runes: true` forced on every suite; whether `assert_html_equal` ignores hydration comment markers.
