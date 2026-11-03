---
id: 01a1a3c1-fa09-7fac-8320-6cf71b906004
title: Compatibility framework `@vigla/sveltekit`
ord: 16
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "src/"
      }
    ],
    "id": "sveltekit",
    "kind": "surface"
  }
edges:
  - kind: imports
    to: 01a193f1-4d97-7589-b3a8-69aa6c365dd0
  - kind: imports
    to: 01a193f1-4d9c-7780-903d-88cd7526d608
  - kind: imports
    to: 01a193f1-4da0-78c5-8389-3b987555f955
  - kind: imports
    to: 01a193f7-755e-71d4-ad4c-01b08be3f25c
  - kind: imports
    to: 01a193fa-a7f2-75b1-8ead-f49c741ddad8
  - kind: imports
    to: 01a1a3c1-fa06-7690-8926-459c574270c3
sources:
  - kind: dir
    ref: packages/sveltekit
---
Stands in for `@sveltejs/kit` 3.1.0 under that alias: each of upstream's export keys that `@vigla/kit` has an entry for, and the `internal/client` and `internal/payload` entries Kit emits into apps under the installed name, re-exports the matching `@vigla/kit` entry, and `types/index.d.ts`, the ambient file tools read by that path, loads Kit's types; `sveltekit()` from `./vite` composes Kit's plugin with `@vigla/vite-plugin-svelte`'s `svelte()`, and the `svelte-kit` bin runs Kit's CLI under this package's version. Its manifest field `vigla.facade` names `@vigla/kit`, by which Kit recognises the name an app installed it under. It carries upstream's version because the ecosystem peer-checks `@sveltejs/kit ^3`, and holds no behaviour of its own.