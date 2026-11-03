---
id: 01a1a11e-857d-786d-98b5-6c7cf0a73dec
title: "`svelte` type declarations"
ord: 7
tags: ["module"]
fields:
  {
    "id": "svelte-types"
  }
edges:
  - kind: imports
    to: 01a18680-7dc4-7cb1-9547-9c9ef3434492
  - kind: imports
    to: 01a18680-7dc5-7a26-b604-0af48b752f02
sources:
  - kind: dir
    ref: packages/svelte/types
  - kind: file
    ref: packages/svelte/action.d.ts
  - kind: file
    ref: packages/svelte/animate.d.ts
  - kind: file
    ref: packages/svelte/compiler.d.ts
  - kind: file
    ref: packages/svelte/conformance/declarations.ts
  - kind: file
    ref: packages/svelte/conformance/tsconfig.json
  - kind: file
    ref: packages/svelte/easing.d.ts
  - kind: file
    ref: packages/svelte/elements.d.ts
  - kind: file
    ref: packages/svelte/index.d.ts
  - kind: file
    ref: packages/svelte/motion.d.ts
  - kind: file
    ref: packages/svelte/store.d.ts
  - kind: file
    ref: packages/svelte/svelte-html.d.ts
  - kind: file
    ref: packages/svelte/transition.d.ts
---
The type surface Svelte's tooling and applications read under the name `svelte`: the ambient `declare module 'svelte…'` blocks of every public entry and `svelte/compiler`, the global runes, `svelte/elements` and the `svelteHTML` namespace svelte2tsx emits against, with the legacy-resolution stubs upstream ships. It states upstream's public type contract as Vigla supports it, and a conformance check holds every declared value to the adapter's runtime entries so the declarations cannot outlive the code.