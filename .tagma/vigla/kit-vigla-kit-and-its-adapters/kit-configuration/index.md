---
id: 01a193f7-7559-796d-9944-6bc3a5ea7546
title: Kit configuration
ord: 7
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "index.ts"
      },
      {
        "at": "errors.ts",
        "for": [
          "8be3f25c"
        ]
      },
      {
        "at": "file.ts",
        "for": [
          "3171b467",
          "8be3f25c",
          "741ddad8"
        ]
      }
    ],
    "id": "kit-config"
  }
edges:
  - kind: imports
    to: 01a193f1-4d97-7589-b3a8-69aa6c365dd0
  - kind: imports
    to: 01a193f1-4d9b-787a-b261-3bc8d5d68827
sources:
  - kind: dir
    ref: packages/kit/src/config
---
Kit 3's configuration as `sveltekit(config)` receives it in `vite.config`: the defaults, the validation whose errors name the offending key path, and the resolved form every build step reads, with paths settled against the Vite root. File-backed callers use the app's Vite to run its configuration hooks before consuming the resolved options.