---
id: 01a18679-1a22-7cc3-8c23-93c4b0fa35f1
title: Runes and async are forced by a module hook wrapping `svelte/compiler`, on the reference and the harness alike
ord: 2
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a18619-654d-70b9-aa41-2a6f0358b0e5
sources:
  - kind: file
    ref: harness/src/force.ts
---
Kit's apps and the plugin's e2e projects are compiled by vite-plugin-svelte inside the Vite processes their tests spawn, so no runner passes compile options as the Svelte suites' runners do. `force.ts`, loaded with `--import` through `NODE_OPTIONS`, resolves every `svelte/compiler` import, and every import of a front end's declared compiler — the entry its package's `exports` give for `vigla.frontEnd.compiler`, which `@vigla/vite-plugin` imports by file URL — to a wrapper whose `compile` sets `experimental.async` and, unless the caller set it, `runes`, and whose `compileModule` sets `experimental.async`. The reference runs load the same hook, so both sides compile under one configuration and no app config changes for it.

The forced module keeps the real compiler's whole surface, since consumers such as `svelte-check` read `VERSION` and the rest beside `compile`. A CommonJS compiler — upstream's UMD `compiler/index.js`, the one `require` reaches — is served as its own source with the forcing appended over `module.exports`: an ES wrapper's `export *` sees none of a UMD bundle's names, and a second CommonJS load of the same file would hit the wrapper's own half-built cache entry, both keyed by filename. An ES compiler gets a wrapper that imports the real module under a second query: under `require`, Node keys even an ES module by filename, so importing the plain path would return the wrapper itself. Because CommonJS keys by filename, the compiler file itself is recognized, however a caller names it — `svelte/compiler`, an absolute path, a `require.resolve` result: the entry is read from its package's `exports` under the request's conditions (`./compiler` for the package named `svelte`, the `vigla.frontEnd.compiler` key otherwise), so a plain first load can never cache an unforced compiler.

Async is forced over an explicit `false`: Kit's basics app passes `async: process.env.SVELTE_ASYNC === 'true'`, and the milestone converts such apps to async on. A process whose package script assigns `NODE_OPTIONS` itself — the plugin's `configfile-custom` sets `--experimental-strip-types` — runs without the hook on both sides.
