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
      },
      {
        "at": "index-server.ts"
      },
      {
        "at": "reactivity.ts"
      },
      {
        "at": "reactivity-server.ts"
      },
      {
        "at": "window.ts"
      },
      {
        "at": "window-server.ts"
      },
      {
        "at": "motion.ts"
      },
      {
        "at": "motion-server.ts"
      },
      {
        "at": "attachments.ts"
      },
      {
        "at": "action.ts"
      }
    ],
    "id": "entries",
    "kind": "surface"
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
  - kind: imports
    to: 01a1878f-918e-7939-ab43-8548688c49ca
  - kind: imports
    to: 01a18792-64a4-7342-8c33-c00c6ca88dc0
sources:
  - kind: dir
    ref: packages/vigla/src/entries
  - kind: file
    ref: packages/vigla/package.json
  - kind: file
    ref: packages/vigla/tsconfig.json
---
The published surface of `vigla`: the runtime entries `vigla`, `vigla/server`, `vigla/reactivity`, `vigla/reactivity/window`, `vigla/motion` and `vigla/internal/*`, and `vigla/compiler`, which composes analysis and generation behind the front-end port and prints with `esrap`. What it exports is all an adapter or an application may reach, and the package's `exports` map is this module's.