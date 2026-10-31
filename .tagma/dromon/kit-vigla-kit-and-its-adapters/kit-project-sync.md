---
id: 01a193f7-755e-71d4-ad4c-01b08be3f25c
title: Kit project sync
ord: 8
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "."
      }
    ],
    "id": "kit-sync"
  }
edges:
  - kind: imports
    to: 01a193f1-4d97-7589-b3a8-69aa6c365dd0
  - kind: imports
    to: 01a193f1-4d9b-787a-b261-3bc8d5d68827
  - kind: imports
    to: 01a193f7-7559-796d-9944-6bc3a5ea7546
sources:
  - kind: dir
    ref: packages/kit/src/sync
---
The project model Kit builds from the file system: the route tree discovered under `src/routes` with its layouts, pages, errors, endpoints and param matchers, validated and sorted, each node's statically readable page options, and the files editors and type checkers read — `.svelte-kit/tsconfig.json`, the ambient and non-ambient declarations, and each route's `$types.d.ts`. It runs at dev start, on route changes and before a build; turning the model into runtime modules is the Vite plugin's work.