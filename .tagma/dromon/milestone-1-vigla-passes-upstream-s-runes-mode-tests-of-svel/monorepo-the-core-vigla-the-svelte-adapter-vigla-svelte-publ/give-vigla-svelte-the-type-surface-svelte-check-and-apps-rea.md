---
id: 01a1a10b-4ac8-77a9-ac7c-f18e83c53a70
title: Give @vigla/svelte the type surface svelte-check and apps read
ord: 3
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1a108-8556-7ceb-800a-4407eb68dbce",
    "status": "done"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faa07b61535
---
Give `@vigla/svelte` the type surface `svelte-check` 4.7.7, svelte2tsx and apps read under the alias `svelte`: `types/index.d.ts` with the ambient `declare module 'svelte…'` blocks of every public entry and `svelte/compiler`, the global rune declarations, `svelte-html.d.ts` (the `svelteHTML` namespace svelte2tsx emits against) and `svelte/elements`. `Component`, `SvelteComponent`, `ComponentConstructorOptions`, `ComponentType` and `Snippet` stay as types because svelte2tsx's shims reference them.

Add the export keys `./elements`, `./internal`, `./internal/disclose-version`, `./internal/flags/tracing`, and a `types` condition on every public key, agreed with the dist/pack staging.

Written anew from the HTML/ARIA specs and upstream's public type contract (rule 864b44df); declarations whose runtime exists in Vigla are tied to it by a type-level check so they cannot drift. Acceptance: upstream's `tests/types` samples check clean with tsrs against these declarations, the Kit `types` suite stays 7/7, and `svelte-check` 4.7.7 over an aliased app reports Svelte 5 diagnostics.
