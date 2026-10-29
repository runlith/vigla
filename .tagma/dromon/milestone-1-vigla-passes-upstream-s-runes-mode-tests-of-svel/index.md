---
id: 01a185b6-09f2-796e-90b2-9fa9658ccea4
title: "Milestone 1: Vigla passes upstream's runes-mode tests of Svelte 5.57.3, SvelteKit 3.1.0 and vite-plugin-svelte 7.3.1"
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
**Outcome.** A monorepo publishing the core `vigla` (compiler core, client and server runtime), the Svelte compatibility adapter `@vigla/svelte`, `@vigla/vite-plugin`, `@vigla/kit` and its adapters, written anew in TypeScript, on which:
- every upstream test in scope has a manifest status, and every entry not dropped passes on Vigla;
- the upstream defects of the frozen list are fixed, each with a test red on upstream and green on Vigla;
- an app on Svelte 5 runes and SvelteKit 3.1 switches by aliasing `svelte` to `@vigla/svelte`, `@sveltejs/kit` to `@vigla/kit` and `@sveltejs/vite-plugin-svelte` to `@vigla/vite-plugin` in its package manager, and upstream `svelte-check` 4.7.7 keeps checking it.

Moving Tagma onto Vigla is stage 2 and outside this spec.

**Scope** ([[019de65b]]). Every upstream test file and sample below is in the manifest:
- Svelte: the suites under `packages/svelte/tests` except runtime-legacy and migrate (legacy mode and the Svelte 4 migration); the unit tests `packages/svelte/src/**/*.test.ts`; `tests/css-parse.test.ts`; `tests/runtime-browser/test-ssr.ts`; `tests/store` pending the stores decision.
- SvelteKit: `packages/kit` unit specs, `test/apps` with each app's Playwright and vitest steps, `test/build-errors`, `test/prerendering`, `test/types`, and the tests of the node, bun and static adapters; the Cloudflare, Vercel, Netlify and auto adapters follow this milestone.
- vite-plugin-svelte: its unit specs and its e2e projects outside the inspector, in each run mode upstream uses (`test:serve`, `test:build`, `test:build:watch`).

**The manifest.** One status per entry, keyed Svelte `suite/sample/variant`, Kit `app/file/title/project/mode`, vite-plugin `project/file/title/mode`. Variants and modes in: Svelte `dom`, `hydrate`, `ssr` and `async-ssr`; Kit dev and build, its Playwright projects with and without JS, and the variant scripts upstream runs (`server-side-route-resolution`, `cross-platform`, `paths-*`), each app only in the modes it has. The harness fails when an entry in scope has no status.

**Statuses**, assigned in this order, each non-contract one with a one-line reason:
1. A sample using a construct Vigla rejects (below) is *converted* when the construct is incidental and *dropped* when it is the subject — the subject is the construct named in the sample's directory name or in its expected diagnostic code.
2. A sample expecting a runes-mode deprecation warning for a construct Vigla rejects is a *difference*: the same code, now an error.
3. A test driving internals — `signals`, the Svelte unit tests and Kit's unit specs — is *converted* to public API where every assertion has a public counterpart, else *covered*: the manifest names the Vigla test asserting the same behaviour through Vigla's module of that subject.
4. An assertion on an internal format — hydration markers, `__svelte_meta`, the CSP script text, the HMR symbol, `$props.id()` text — is *contract* when Vigla keeps the format, else a *difference* naming the format.
5. A difference is any other upstream expectation Vigla changes on purpose: a fixed defect, an outcome of async being the only mode.
6. Everything else is *contract*. A converted test counts only once it passes on upstream. The published list of differences is the manifest's projection.

The reference configuration is runes forced and async on, for every test that compiles components; a Kit app upstream compiles with async off is converted to async on. Tests that compile nothing (parser, print, preprocess, css-parse) run as they are; the `types` suite is checked with tsrs.

**Legacy is a compile error.** Everything upstream rejects in runes mode; everything it deprecates in runes mode — `on:` on elements, `<slot>` outside custom elements, `<svelte:component>`, `<svelte:self>`, `context="module"`, the `accessors` and `immutable` options; the Svelte 4 interop upstream still accepts in runes mode without a warning — `on:` on components, `let:` directives, `<svelte:fragment>` and a `slot` attribute assigning content to a component's slot (elsewhere `slot` stays an HTML attribute) — since no Vigla component emits component events or renders a Svelte slot; components compiled with `runes: false`; the imports `createEventDispatcher`, `beforeUpdate`, `afterUpdate`, `spring` and `tweened` (the `Spring` and `Tween` classes stay); the entries `svelte/legacy` and `svelte/internal/flags/legacy`. A diagnostic keeps upstream's code and message where upstream has one. The types `SvelteComponent`, `ComponentConstructorOptions` and `ComponentType` stay as types only: `svelte-check` 4.7.7's shims reference them.

**Upstream defects.** The first task is a research of open `sveltejs/svelte` and `sveltejs/kit` issues; it selects issues labelled as bugs, with a reproduction, in runes mode, async mode or SvelteKit 3, in an area of the contract. The list is frozen when that research lands; later finds go to the next milestone. An entry whose reproduction does not fail on Svelte 5.57.3, Kit 3.1.0 or vite-plugin-svelte 7.3.1 leaves the list, its run recorded as the evidence. The scheduler traps of [[9d5e3831]] are on it. Each fix is a difference with its own test.

**Order.** Foundation and harness first, the harness validated on upstream before any Vigla code ([[07b61535]], [[49056597]]); runtime and compiler together, since neither runs a sample alone, with Kit's contract on them written from the start ([[ec26636a]], [[9d5e3831]], [[9ca8ebb2]]) and the application primitives designed with them ([[8191e72f]]); then the Vite plugin and Kit ([[e34c15e3]]).

**Benchmarks.** Vigla owns ports of upstream's `compiler`, `reactivity` and `ssr` benchmarks over public API — the compiler's `parse` and `compile`, `.svelte.js` modules using `$state`, `$derived`, `$effect.root` and `flushSync`, `render` — run against both targets on one machine: ten runs per target, alternating, medians compared. The performance targets they are judged by stand in a spec of their own under this one.

**Open for the operator.**
- Stores (`svelte/store`, `$store`, `tests/store`): recommended kept — stores are not legacy mode, 39 runes samples use them and `motion` imports them; Kit 3 already dropped `$app/stores`.
- Remote functions, experimental behind a flag in Kit 3.1: recommended in, with no flag; the `async` app holds 71 of the 72 `.remote.*` files, so leaving them out removes most of Kit's async coverage.
- Out of this milestone, recommended: the `snapshot` suite (it pins upstream's generated code, which a new code generator does not reproduce), `@sveltejs/package`, `@sveltejs/enhanced-img` and the vite-plugin inspector.

**Acceptance.**
- The manifest gives every upstream test in scope a status, and every non-contract status a reason.
- Every entry not dropped passes on Vigla in the repository's full test run.
- Every defect of the frozen list has a test red on Svelte 5.57.3 or Kit 3.1.0 and green on Vigla.
- Kit's `basics` app, converted to runes with its conversions recorded in the manifest, builds and passes its tests on an aliased install, and `svelte-check` 4.7.7 reports the same diagnostics over it on Vigla as on upstream.
- The performance targets hold.
- Every child spec's acceptance holds.
