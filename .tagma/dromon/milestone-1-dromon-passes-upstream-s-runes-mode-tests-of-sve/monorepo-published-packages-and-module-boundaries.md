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
**Packages.** A Bun workspace with `packages/dromon` (published `dromon`), `packages/vite-plugin`, `packages/kit` and one package per adapter in scope. The compiler and the runtime stay one published package, as upstream's: compiled components import the runtime from the package and version the compiler belongs to.

**Installed as `svelte`.** In this milestone Dromon's packages are consumed under upstream's names through package-manager aliases, so what upstream tooling and libraries read must hold for them:
- `svelte-check` 4.7.7 resolves `svelte/package.json`, `require`s `<package dir>/compiler` and switches to Svelte 5 handling by the major version; vite-plugin-svelte reads `VERSION` (async from 5.36.0) and builds its prebundle lists from the package's `exports` and `dependencies`; third-party libraries declare `svelte` peer ranges such as `^5.0.0`. Dromon's published version therefore stays inside upstream's 5.x line, and `VERSION` reports the same; Dromon's own release identity is a separate field.
- A root `compiler/` directory holds a CommonJS bundle with `{"type": "commonjs"}`, loadable by synchronous `require`: no top-level await anywhere in the compiler's module graph.
- The `exports` map has upstream's keys and conditions — `./compiler` with its `require` condition included — minus `./legacy`, `./internal/flags/legacy` and `./internal/flags/async`; `./store` pending the stores decision.
- Compiled output imports `svelte/internal/*` and the types declare upstream's ambient modules (`declare module 'svelte'`, `'svelte/compiler'`, …). A plain `dromon/*` specifier is decided with the TSX input, not here.

**Boundaries inside `dromon`** are `#module` cards, not packages: a bottom shared module (the constants, escaping, HTML tree validation and utilities both sides use); on the compiler side the `.svelte` front end (parser and syntax-bound diagnostics), IR, analysis, client transform, server transform and CSS; on the runtime side reactivity (signals and scheduler), DOM (client rendering and hydration) and server rendering; the public entry modules above them. Compiler and runtime never import each other, both import the shared module; reactivity is the runtime's bottom floor; analysis and the transforms have no relation to the front end. `tagma.config.ts` declares `Imports.modules` with the first code, enforced at gate before `submit_work` with no debt.

**Dependencies.** Published packages carry no Effect and no framework of ours: the runtime ships to every user's browser and the compiler runs in Vite's hot path and in browsers. The runtime depends on no more than upstream's runtime does (`clsx`, `devalue`, `esm-env`). The compiler's JS/TS parser and printer are chosen by [[9ca8ebb2]]; its a11y data comes from `aria-query` and `axobject-query` pinned at upstream's versions (`aria-query` exactly 5.3.1), which the validator expectations depend on.

**Toolchain.** `bun install`; vitest, with jsdom where upstream runs jsdom and Playwright's bundled Chromium where upstream runs a browser — Kit's `channel: 'chrome'` is replaced by it; types checked with tsrs. A package publishes unminified JS with `.d.ts`, declaration maps, sourcemaps and its `src`.

**Acceptance.**
- Every package builds and typechecks clean with tsrs.
- The module cards exist and the import rule is enforced at gate with zero debt.
- The packed `dromon` package has exactly the `exports` keys above, a `compiler/index.js` that `require` loads in Node, and a `version` in the 5.x line.
- `svelte-check` 4.7.7 runs over an app with `svelte` aliased to the packed `dromon` and reports Svelte 5 diagnostics.
