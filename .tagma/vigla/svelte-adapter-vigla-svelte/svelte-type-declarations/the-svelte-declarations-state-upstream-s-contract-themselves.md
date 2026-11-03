---
id: 01a1a11f-d65a-71c0-ac27-57eee8034bfb
title: The `svelte` declarations state upstream's contract themselves, held to the adapter's runtime by a conformance check
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/svelte/conformance/declarations.ts
  - kind: file
    ref: packages/svelte/types/index.d.ts
---
The ambient blocks state upstream's public names and shapes themselves rather than re-exporting the adapter's or the core's types. Whenever `types/index.d.ts` is in a program, an ambient `declare module 'svelte…'` wins over package resolution, so these blocks are the whole surface a checker sees. A re-export from `vigla` would leak core names into hovers and into libraries' emitted declarations, where `vigla` does not resolve from the library under a strict install.

`conformance/declarations.ts`, checked by the root `typecheck`, keeps them tied to the code. Every declared value of each module exists in both of the adapter's runtime variants (client and server). For the runtime modules, each runtime export is also assignable to its declaration. `svelte/compiler` is held only by export names and by the keys of `CompileOptions` and `ModuleCompileOptions`, because the adapter types the same AST and source maps in its own representation.

Five functions are exempt from the assignability check:
- `mount`, `hydrate` and `render` take the svelte2tsx-facing `Component`, `(internals, props)`, while compiled components are the core's `(anchor, props)`.
- `createRawSnippet` returns the template-facing `Snippet`.
- `crossfade` is declared as returning `TransitionConfig`, because svelte2tsx's transition check requires it; the runtime truthfully types `undefined` when no counterpart or fallback exists.

`SvelteMap` is also exempt for the server variant alone. There, as in upstream's server entry, it is the host's plain `Map`, so `getOrInsert` and `getOrInsertComputed` exist only where the platform provides them, while the declaration states the client class.

Assignability accepts a runtime export that has members the declaration lacks, so the check cannot catch a declaration that omits a method the runtime has.
