---
id: 01a1868a-e2df-7f72-ac44-e6325b1f4b6a
title: "Compiled output imports the runtime its caller names: `svelte/internal/*` for `.svelte`"
ord: 1
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9faa07b61535
sources:
  - kind: file
    ref: packages/dromon/src/entries/compiler.ts
  - kind: file
    ref: packages/svelte/src/compiler/index.ts
---
`compile` and `compileModule` take `runtime`, the specifiers generated code imports its client and server runtime from; absent, `dromon/internal/client` and `dromon/internal/server`. The Svelte adapter passes `svelte/internal/client` and `svelte/internal/server`: an app that switches by aliasing `svelte` declares only `svelte`, so under a strict install `dromon`, a dependency of the adapter, need not resolve from its source files, and vite-plugin-svelte builds its prebundling lists from the `svelte` package's exports. Both names still reach one runtime instance because each adapter entry re-exports the matching core entry, and the core stays free of the `svelte` name.
