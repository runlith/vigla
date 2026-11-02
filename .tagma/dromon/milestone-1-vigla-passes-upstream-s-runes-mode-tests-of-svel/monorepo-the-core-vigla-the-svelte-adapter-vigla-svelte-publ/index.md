---
id: 01a185b6-09f2-796e-90b2-9faa07b61535
title: "Monorepo: the core `vigla`, the Svelte adapter `@vigla/svelte`, published packages and module boundaries"
ord: 1
tags: ["spec"]
fields:
  {
    "status": "open"
  }
sources:
  - kind: file
    ref: bun.lock
---
**Packages.** A Bun workspace:
- `packages/vigla`, published `vigla` — the core: the template IR, analysis, client and server code generation, CSS scoping, the runtime (reactivity and scheduler, DOM rendering and hydration, server rendering) and, later, the TSX front end; its own version line.
- `packages/svelte`, published `@vigla/svelte` — the Svelte compatibility adapter, installed under the alias `svelte`.
- `packages/vite-plugin` (`@vigla/vite-plugin`), `packages/kit` (`@vigla/kit`) and one package per Kit adapter in scope.

The compiler core and the runtime stay one package, as upstream's: compiled components import the runtime of the package and version that compiled them.

**The core knows no Svelte.** No module of `vigla` imports a `svelte` specifier, declares a `svelte` module or depends on the `svelte` package. Data formats upstream's tests and tools read under Svelte's name are named by the core in its own words and given upstream's names by the adapter ([[ec26636a]]); the parser's npm scope (`@sveltejs/acorn-typescript`) is a dependency, not a name the product shows, and stays. A front end fills the core's port, turning one source form into the template IR, the script ESTree and its syntax-bound diagnostics ([[9ca8ebb2]]); the core has no relation to any front end. Runes are named exports of `vigla` for its native format ([[8cd5da81]]).

**The adapter carries what Svelte's world reads** — `svelte-check` 4.7.7, vite-plugin-svelte, SvelteKit and third-party libraries:
- the `.svelte` front end, global runes in `.svelte` and `.svelte.js`/`.svelte.ts`, and `svelte/compiler` over the core;
- a root `compiler/` directory holding a CommonJS bundle with `{"type": "commonjs"}`, loadable by synchronous `require` — `svelte-check` `require`s it — so no top-level await anywhere in its module graph;
- a version in upstream's 5.x line and `VERSION` reporting the same: `svelte-check` switches to Svelte 5 handling by the major, vite-plugin-svelte reads `VERSION` (async from 5.36.0) and builds its prebundle lists from the package's `exports` and `dependencies`, libraries declare `svelte` peer ranges such as `^5.0.0`;
- upstream's `exports` keys — `./compiler` with its `require` condition included — minus `./legacy`, `./internal/flags/legacy` and `./internal/flags/async`; every runtime entry re-exports the core's matching entry, so code reaching the runtime as `svelte` and as `vigla` shares one instance;
- upstream's ambient modules (`declare module 'svelte'`, `'svelte/compiler'`, …) and the global rune declarations;
- compiled `.svelte` output imports `svelte/internal/*`, which re-exports `vigla/internal/*`.

**Boundaries** are `#module` cards. In `vigla`: a bottom shared module (constants, escaping, HTML tree validation, utilities both sides use); on the compiler side IR, analysis, client transform, server transform and CSS; on the runtime side reactivity (signals and scheduler), DOM (client rendering and hydration) and server rendering; the public entries above them. Compiler and runtime never import each other; both import the shared module; reactivity is the runtime's bottom floor. In `@vigla/svelte`: the front end, the compiler API and the entry re-exports, reaching `vigla` only through its published entries. `tagma.config.ts` declares `Imports.modules` with the first code, enforced at gate before `submit_work` with no debt.

**Dependencies.** Published packages carry no Effect and no framework of ours: the runtime ships to every user's browser and the compiler runs in Vite's hot path and in browsers. The runtime depends on no more than upstream's runtime does (`clsx`, `devalue`, `esm-env`). The JS/TS parser and printer are chosen by [[9ca8ebb2]]; a11y data comes from `aria-query` and `axobject-query` pinned at upstream's versions (`aria-query` exactly 5.3.1), which the validator expectations depend on.

**Toolchain.** `bun install`; vitest, with jsdom where upstream runs jsdom and Playwright's bundled Chromium where upstream runs a browser — Kit's `channel: 'chrome'` is replaced by it; types checked with tsrs. A package publishes unminified JS with `.d.ts`, declaration maps, sourcemaps and its `src`.

**Acceptance.**
- Every package builds and typechecks clean with tsrs.
- The module cards exist and the import rule is enforced at gate with zero debt.
- No file of `packages/vigla` imports a `svelte` specifier or declares a `svelte` module, and its `package.json` does not depend on `svelte`.
- The packed `@vigla/svelte` has exactly the `exports` keys above, a `compiler/index.js` that `require` loads in Node, and a `version` in the 5.x line.
- `svelte-check` 4.7.7 runs over an app with `svelte` aliased to the packed `@vigla/svelte` and reports Svelte 5 diagnostics.
- In an app with `svelte` aliased, state created through `svelte` is read reactively through `vigla`: one runtime instance.
