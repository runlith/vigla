---
id: 01a1a3c1-fa06-7690-8926-459c574270c3
title: Compatibility plugin `@vigla/vite-plugin-svelte`
ord: 28
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "src/index.ts"
      }
    ],
    "id": "vite-plugin-svelte",
    "kind": "surface"
  }
edges:
  - kind: imports
    to: 01a187ca-e656-7569-8564-ac0fabdaf506
sources:
  - kind: dir
    ref: packages/vite-plugin-svelte
---
Stands in for `@sveltejs/vite-plugin-svelte` 7.3.1 under that alias: its `svelte()` is `@vigla/vite-plugin`'s plugin under the identity `vite-plugin-svelte`, the marker name third-party Vite plugins and frameworks look up, `loadSvelteConfig` loads `svelte.config.*`, and `vitePreprocess` and the option types are the product's. It carries upstream's version because libraries peer-check that name's major; all behaviour stays in the plugin.