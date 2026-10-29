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
- every upstream test of the contract set passes through Dromon's own runners;
- the upstream defects chosen for this milestone are fixed, each with a test red on upstream and green on Dromon;
- an app on Svelte 5 runes and SvelteKit 3.1 switches by aliasing `svelte`, `@sveltejs/kit` and `@sveltejs/vite-plugin-svelte` in its package manager, and upstream `svelte-check` 4.7.7 keeps checking it.

Moving Tagma onto Dromon is stage 2 and outside this spec.

**The contract set** ([[019de65b]]). Every upstream test below gets one status in a manifest kept in the repository: contract, converted, dropped, or difference, each non-contract status with a one-line reason.
- Svelte, compiled with runes forced and async on: runtime-runes, hydration, server-side-rendering, runtime-browser with custom elements, runtime-production, runtime-xhtml, css, validator, compiler-errors, parser-legacy, parser-modern, print, preprocess, sourcemaps, motion, types. A sample upstream itself passes that way is contract. One that fails that way only because it is written in legacy syntax while testing something else is converted to runes and stays; one that tests a legacy construct is dropped.
- Svelte suites out entirely: runtime-legacy and migrate (legacy mode and the Svelte 4 migration), snapshot (pins upstream's generated code, which Dromon's code generator does not reproduce), signals (drives runtime internals).
- SvelteKit: the integration apps and their Playwright tests, in dev and build, apps converted to runes where they use legacy syntax. Kit's unit specs drive its internal functions and are read, not ported.
- vite-plugin-svelte: the e2e entries except the inspector ones; its unit specs are read, not ported.
- A difference is an upstream expectation Dromon changes on purpose — a fixed defect, an outcome of async being the only mode. The published list of differences is the manifest's projection.

**Legacy is a compile error.** Everything upstream rejects in runes mode, everything it deprecates in runes mode, `createEventDispatcher`, `svelte/legacy` and `svelte/internal/flags/legacy`. There is no legacy mode: every component compiles as runes. A diagnostic keeps upstream's code and message where upstream has one, so tooling shows what it shows today.

**Upstream defects.** The scheduler traps of [[9d5e3831]] and the open upstream defects a research of `sveltejs/svelte` and `sveltejs/kit` issues selects; that research is the first task of this milestone. Each fix is a difference with its own test.

**Order.** Foundation and harness first, the harness validated on upstream before any Dromon code ([[07b61535]], [[49056597]]); runtime and compiler together, since neither runs a sample alone ([[ec26636a]], [[9d5e3831]], [[9ca8ebb2]]); then the Vite plugin and Kit ([[e34c15e3]]).

**Open for the operator.**
- Stores (`svelte/store`, `$store`): recommended kept — stores are not legacy mode, 39 runes samples and many libraries use them; Kit 3 already dropped `$app/stores`.
- Remote functions, experimental behind a flag in Kit 3.1: recommended in, with no flag.
- Adapters in this milestone: recommended node, static and auto; the rest later.
- Package names `dromon`, `@dromon/kit`, `@dromon/vite-plugin`, `@dromon/adapter-*`: whether the `@dromon` scope is free on npm is not verified.

**Acceptance.**
- The manifest gives every upstream test of the listed suites a status, and every non-contract status a reason.
- Every contract entry passes on Dromon in the repository's full test run.
- Every defect fixed has a test red on svelte 5.57.3 or Kit 3.1.0 and green on Dromon.
- Kit's `basics` app, switched by package-manager aliases, builds, passes its tests and gets the same `svelte-check` 4.7.7 diagnostics on Dromon as on upstream.
- Upstream's `compiler`, `reactivity` and `ssr` benchmarks run on Dromon and on upstream on one machine; the results are recorded in a research block, and a Dromon result slower than upstream beyond the run-to-run spread is a defect fixed before the milestone closes.
