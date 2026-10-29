---
id: 01a18687-b5c2-718d-b1a7-89399f16e731
title: The core's runtime loads no package beyond `clsx`, `devalue` and `esm-env`
ord: 11
tags: ["rule"]
edges:
  - kind: relates
    to: 01a18605-d03d-737c-9a72-8cc4b3360999
sources:
  - kind: dir
    ref: packages/dromon/src/runtime
  - kind: dir
    ref: packages/dromon/src/shared
  - kind: file
    ref: packages/dromon/src/entries/index.ts
  - kind: file
    ref: packages/dromon/src/entries/server.ts
  - kind: file
    ref: packages/dromon/src/entries/internal/client.ts
  - kind: file
    ref: packages/dromon/src/entries/internal/server.ts
---
This covers the runtime modules, the shared module beneath them and the runtime entries — everything an application loads from `dromon` in the browser or on the server. A type-only import is no load; compiler code may load other packages.