---
id: 01a185b6-09f2-796e-90b2-9fa9658ccea4
title: "Milestone 1: Dromon passes upstream's runes-mode tests of Svelte 5.57.3, SvelteKit 3.1.0 and vite-plugin-svelte 7.3.1"
ord: 12
tags: ["spec"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a1852f-ba89-7089-9ac3-30e6011655b8
  - kind: relates
    to: 01a1852f-ba89-7089-9ac3-30e788b9f5b3
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fa8019de65b
---
**Outcome.** A monorepo publishing `dromon` (compiler, client and server runtime), `@dromon/vite-plugin`, `@dromon/kit` and its adapters, written anew in TypeScript, on which:
- every upstream test in scope has a manifest status, and every entry not dropped passes on Dromon;
- the upstream defects of the frozen list are fixed, each with a test red on upstream and green on Dromon;
- an app on Svelte 5 runes and SvelteKit 3.1 switches by aliasing `svelte`, `@sveltejs/kit` and `@sveltejs/vite-plugin-svelte` to Dromon's packages in its package manager, and upstream `svelte-check` 4.7.7 keeps checking it.

Moving Tagma onto Dromon is stage 2 and outside this spec.

**Scope** ([[019de65b]]). Every upstream test file and sample below is in the manifest:
- Svelte: the suites under `packages/svelte/tests` except runtime-legacy and migrate (legacy mode and the Svelte 4 migration); the unit tests `packages/svelte/src/**/*.test.ts`; `tests/css-parse.test.ts`; `tests/runtime-browser/test-ssr.ts`; `tests/store` pending the stores decision.
- SvelteKit: `packages/kit` unit specs, `test/apps` with each app's Playwright and vitest steps, `test/build-errors`, `test/prerendering`, `test/types`, and the tests of the adapters in scope.
- vite-plugin-svelte: its unit specs and its e2e projects outside the inspector, in each run mode upstream uses (`test:serve`, `test:build`, `test:build:watch`).

**The manifest.** One status per entry, keyed Svelte `suite/sample/variant`, Kit `app/file/title/project/mode`, vite-plugin `project/file/title/mode`. Variants and modes in: Svelte `dom`, `hydrate`, `ssr` and `async-ssr`; Kit dev and build, its Playwright projects with and without JS, and the variant scripts upstream runs (`server-side-route-resolution`, `cross-platform`, `paths-*`), each app only in the modes it has. The harness fails when an entry in scope has no status.

**Statuses**, assigned in this order, each non-contract one with a one-line reason:
1. A sample using a construct Dromon rejects (below) is *converted* when the construct is incidental and *dropped* when it is the subject — the subject is the construct named in the sample's directory name or in its expected diagnostic code.
2. A sample expecting a runes-mode deprecation warning for a construct Dromon rejects is a *difference*: the same code, now an error.
3. A test driving internals — `signals`, the Svelte unit tests and Kit's unit specs — is *converted* to public API where every assertion has a public counterpart, else *covered*: the manifest names the Dromon test asserting the same behaviour through Dromon's module of that subject.
4. An assertion on an internal format — hydration markers, `__svelte_meta`, the CSP script text, the HMR symbol, `$props.id()` text — is *contract* when Dromon keeps the format, else a *difference* naming the format.
5. A difference is any other upstream expectation Dromon changes on purpose: a fixed defect, an outcome of async being the only mode.
6. Everything else is *contract*. A converted test counts only once it passes on upstream. The published list of differences is the manifest's projection.

The reference configuration is runes forced and async on, for every test that compiles components; a Kit app upstream compiles with async off is converted to async on. Tests that compile nothing (parser, print, preprocess, css-parse) run as they are; the `types` suite is checked with tsrs.

**Legacy is a compile error.** Everything upstream rejects in runes mode; everything it deprecates in runes mode — `on:` on elements, `<slot>` outside custom elements, `<svelte:component>`, `<svelte:self>`, `context="module"`, the `accessors` and `immutable` options; components compiled with `runes: false`; the imports `createEventDispatcher`, `beforeUpdate`, `afterUpdate`, `spring` and `tweened` (the `Spring` and `Tween` classes stay); the entries `svelte/legacy` and `svelte/internal/flags/legacy`. A diagnostic keeps upstream's code and message where upstream has one. The types `SvelteComponent`, `ComponentConstructorOptions` and `ComponentType` stay as types only: `svelte-check` 4.7.7's shims reference them.

**Upstream defects.** The first task is a research of open `sveltejs/svelte` and `sveltejs/kit` issues; it selects issues labelled as bugs, with a reproduction, in runes mode, async mode or SvelteKit 3, in an area of the contract. The list is frozen when that research lands; later finds go to the next milestone. The scheduler traps of [[9d5e3831]] are on it. Each fix is a difference with its own test.

**Order.** Foundation and harness first, the harness validated on upstream before any Dromon code ([[07b61535]], [[49056597]]); runtime and compiler together, since neither runs a sample alone, with Kit's contract on them written from the start ([[ec26636a]], [[9d5e3831]], [[9ca8ebb2]]); then the Vite plugin and Kit ([[e34c15e3]]).

**Benchmarks.** Dromon owns ports of upstream's `compiler`, `reactivity` and `ssr` benchmarks over public API — the compiler's `parse` and `compile`, `.svelte.js` modules using `$state`, `$derived`, `$effect.root` and `flushSync`, `render` — run against both targets on one machine: ten runs per target, alternating, median compared. A Dromon median more than 5% slower than upstream's is a defect fixed before the milestone closes; the results go into a research block.

**Open for the operator.**
- Stores (`svelte/store`, `$store`, `tests/store`): recommended kept — stores are not legacy mode, 39 runes samples use them and `motion` imports them; Kit 3 already dropped `$app/stores`.
- Remote functions, experimental behind a flag in Kit 3.1: recommended in, with no flag; the `async` app holds 71 of the 72 `.remote.*` files, so leaving them out removes most of Kit's async coverage.
- Adapters: recommended node and static; `adapter-auto` installs the Vercel, Cloudflare and Netlify adapters, so it waits for them.
- Out of this milestone, recommended: the `snapshot` suite (it pins upstream's generated code, which a new code generator does not reproduce), `@sveltejs/package`, `@sveltejs/enhanced-img` and the vite-plugin inspector.
- Package names `dromon`, `@dromon/kit`, `@dromon/vite-plugin`, `@dromon/adapter-*`: npm `dromon` is free, the `@dromon` scope is not verified.
- The harness against rule [[468243f4]]: thousands of entries stay red until built. Proposed: the run against Dromon is a progress report, not the repository's test suite; an entry joins the test suite in the change that makes it pass, and from then on a red is a failing test under the rule.

**Acceptance.**
- The manifest gives every upstream test in scope a status, and every non-contract status a reason.
- Every entry not dropped passes on Dromon in the repository's full test run.
- Every defect of the frozen list has a test red on Svelte 5.57.3 or Kit 3.1.0 and green on Dromon.
- Kit's `basics` app, converted to runes with its conversions recorded in the manifest, builds and passes its tests on an aliased install, and `svelte-check` 4.7.7 reports the same diagnostics over it on Dromon as on upstream.
- The benchmark protocol above passes for every ported benchmark.
