---
id: 01a1a3ed-6688-7f72-8a35-40a7baff1c75
title: The Vite plugin shows its own names; upstream's move into @vigla/vite-plugin-svelte
ord: 1
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a1a3ed-6688-7f72-8a35-40a5ff420c2e
---
The plugin's identity grows from one name to every name it shows — options, the HMR warnings event, the style query marker, the module meta key, the optimizer's metadata file, the upstream packages it treats specially, documentation links. `PluginFactory` becomes generic over its options. `@vigla/vite-plugin-svelte` supplies upstream's identity and option names. Owns the `products-name-no-svelte` debt of `packages/vite-plugin`.