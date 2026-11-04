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
Stands in for `@sveltejs/vite-plugin-svelte` 7.3.1 under that alias: its `svelte()` is `@vigla/vite-plugin`'s plugin under upstream's identity — the marker name `vite-plugin-svelte` that third-party Vite plugins and frameworks look up, upstream's option names (`prebundleSvelteLibraries`, `experimental.disableSvelteResolveWarnings`) accepted inline and in `svelte.config.*`, its HMR event, style query, module meta key, metadata file and documentation links — and carries upstream's history: options promoted out of `experimental` and the warning on the removed `api.sveltePreprocess`. `loadSvelteConfig` loads `svelte.config.*`, and `vitePreprocess` and the option types are the product's, with upstream's option names. It carries upstream's version because libraries peer-check that name's major; all behaviour stays in the plugin.
