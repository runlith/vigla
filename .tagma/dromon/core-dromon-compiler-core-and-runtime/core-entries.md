---
id: 01a18680-7dc2-71f8-be01-915833d45c4b
title: Core entries
ord: 9
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "index.ts"
      },
      {
        "at": "server.ts"
      },
      {
        "at": "compiler.ts"
      },
      {
        "at": "internal/client.ts"
      },
      {
        "at": "internal/server.ts"
      }
    ],
    "id": "entries"
  }
edges:
  - kind: imports
    to: 01a18680-7db9-7c10-b0ec-c0d1e0e72677
  - kind: imports
    to: 01a18680-7dbb-7e28-818d-c9e31564a15f
  - kind: imports
    to: 01a18680-7dbc-7244-b1cc-b88469397a8d
  - kind: imports
    to: 01a18680-7dbd-7ae0-84ae-0bacb1135202
  - kind: imports
    to: 01a18680-7dbe-7f74-92f0-3f8330c2730c
  - kind: imports
    to: 01a18680-7dbf-7586-9429-a423940f08ed
  - kind: imports
    to: 01a18680-7dc0-713c-85e6-a5df365e9754
  - kind: imports
    to: 01a18680-7dc1-7c56-81a9-8c98fa24c1dc
sources:
  - kind: dir
    ref: packages/dromon/src/entries
  - kind: file
    ref: packages/dromon/package.json
  - kind: file
    ref: packages/dromon/tsconfig.json
---
The published surface of `dromon`: the runtime entries `dromon`, `dromon/server` and `dromon/internal/*`, and `dromon/compiler`, which composes analysis and generation behind the front-end port and prints with `esrap`. What it exports is all an adapter or an application may reach, and the package's `exports` map is this module's.