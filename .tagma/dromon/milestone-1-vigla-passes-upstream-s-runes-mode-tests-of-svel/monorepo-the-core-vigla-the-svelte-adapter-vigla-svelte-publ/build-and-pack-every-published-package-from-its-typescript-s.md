---
id: 01a1a11d-7004-7f98-84fd-f977f9431615
title: Build and pack every published package from its TypeScript sources
ord: 4
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1a103-2b70-7861-9b0f-32e38cb481b8",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faa07b61535
---
Every package's `exports` point at `src/*.ts`, which Node refuses to load from `node_modules`, and `bun pm pack` 1.4.4 ignores `publishConfig`, so nothing could be installed outside the workspace. Give each package a `build` script that emits `dist` beside `src` with tsrs (JavaScript, declarations, declaration maps, sourcemaps), and a `pack` that builds, stages a publish manifest derived from the workspace one and runs `bun pm pack`, owned by a `release` module every release reuses. The workspace keeps running from `src`.