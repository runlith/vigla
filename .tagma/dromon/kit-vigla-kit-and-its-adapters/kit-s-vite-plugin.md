---
id: 01a193fa-a7f2-75b1-8ead-f49c741ddad8
title: Kit's Vite plugin
ord: 11
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "."
      }
    ],
    "id": "kit-vite"
  }
edges:
  - kind: imports
    to: 01a18680-7dc2-71f8-be01-915833d45c4b
  - kind: imports
    to: 01a187ca-e656-7569-8564-ac0fabdaf506
  - kind: imports
    to: 01a193f1-4d97-7589-b3a8-69aa6c365dd0
  - kind: imports
    to: 01a193f1-4d9b-787a-b261-3bc8d5d68827
  - kind: imports
    to: 01a193f1-4da0-78c5-8389-3b987555f955
  - kind: imports
    to: 01a193f6-64d6-7c4a-a9d2-cd17f905dd76
  - kind: imports
    to: 01a193f7-7559-796d-9944-6bc3a5ea7546
  - kind: imports
    to: 01a193f7-755e-71d4-ad4c-01b08be3f25c
sources:
  - kind: dir
    ref: packages/kit/src/vite
---
`sveltekit(config)` from `@sveltejs/kit/vite`: the app's front ends through `@vigla/vite-plugin` plus Kit's own plugins — Vite's environments and aliases, `$app/*` and `$env/*` resolution, the virtual modules that turn the route tree into the server manifest and options and the client app, Kit's components compiled for the app's format, the guard that keeps server-only modules out of the browser, the remote-function transform, the dev server's middleware, the client, server and service-worker builds, and preview. It wires the modules beneath it together and owns no runtime behaviour of its own.