---
id: 01a193f1-6c19-7cfd-849a-b78f130836eb
title: Kit's runtime loads no runtime built-in and touches no Node-only global
ord: 5
tags: ["rule"]
fields:
  {
    "enforcement": {
      "debt": [],
      "escaped": [],
      "inspection": "kit-web-only",
      "on": [
        {
          "op": "submit_work",
          "phase": "before"
        },
        {
          "op": "merge_worktree",
          "phase": "before"
        }
      ],
      "strictness": "gate"
    }
  }
edges:
  - kind: relates
    to: 01a193ed-396f-73b6-bbe3-bad77aa7b0be
sources:
  - kind: dir
    ref: packages/kit/src/client
  - kind: dir
    ref: packages/kit/src/entries
  - kind: dir
    ref: packages/kit/src/server
  - kind: dir
    ref: packages/kit/src/shared
  - kind: dir
    ref: packages/kit/src/types
---
Covers Kit's server, client and shared runtime, its public types and entries. No `node:*`, `bun`, `bun:*` or bare Node built-in import, static or dynamic, no `process.getBuiltinModule`, and no `process`, `Buffer`, `require`, `global`, `setImmediate`, `__dirname` or `__filename`. What a platform has — environment variables, an async-context store such as `AsyncLocalStorage`, file reads, source-mapped stacks — reaches the runtime through `Server.init` or the request options, passed by the dev server, the prerenderer or an adapter. Node and Bun glue belongs to `kit-node`, the Vite plugin, the build and the adapters.