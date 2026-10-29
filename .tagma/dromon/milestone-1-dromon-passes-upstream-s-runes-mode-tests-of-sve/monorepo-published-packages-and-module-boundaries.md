---
id: 01a185b6-09f2-796e-90b2-9faa07b61535
title: Monorepo, published packages and module boundaries
ord: 1
tags: ["spec"]
fields:
  {
    "status": "open"
  }
---
**Packages.** A Bun workspace with `packages/dromon` (published `dromon`), `packages/vite-plugin`, `packages/kit` and one package per adapter. The compiler and the runtime stay one published package, as in upstream: compiled components import the runtime from the same package and version the compiler belongs to.

**Public surface of `dromon`.** The entry points of `svelte` 5.57.3 minus `./legacy`, `./internal/flags/legacy` and `./internal/flags/async` (async is the only mode); `./store` pending the stores decision. Public names and type shapes match upstream's, so code typed against `svelte` typechecks against `dromon` aliased as `svelte`; the `types` suite checks it.

**Boundaries inside `dromon`** are `#module` cards, not packages: parser, IR, analysis, client transform, server transform and CSS on the compiler side; reactivity (signals and scheduler), DOM (client rendering and hydration) and server rendering on the runtime side; the public entry modules above them. Compiler modules never import runtime modules and the reverse; inside the runtime, reactivity is the bottom floor. `tagma.config.ts` declares `Imports.modules` with the first code, enforced at gate before `submit_work` with no debt.

**Dependencies.** Published packages carry no Effect and no framework of ours: the runtime ships to every user's browser and the compiler runs in Vite's hot path and in browsers. The runtime depends on no more than upstream's runtime does (`clsx`, `devalue`, `esm-env`). The compiler's JS/TS parser and ESTree printer are chosen by [[9ca8ebb2]].

**Toolchain.** `bun install`; vitest, with jsdom where upstream runs jsdom and Playwright Chromium where upstream runs a browser; types checked with tsrs. A package publishes unminified JS in `dist` with `.d.ts`, declaration maps, sourcemaps and its `src`.

**Acceptance.**
- Every package builds and typechecks clean with tsrs.
- The module cards exist and the import rule is enforced at gate with zero debt.
- `npm pack --dry-run` of `dromon` lists the entry points above with `dist`, declarations, maps and `src`, and no other entry point.
