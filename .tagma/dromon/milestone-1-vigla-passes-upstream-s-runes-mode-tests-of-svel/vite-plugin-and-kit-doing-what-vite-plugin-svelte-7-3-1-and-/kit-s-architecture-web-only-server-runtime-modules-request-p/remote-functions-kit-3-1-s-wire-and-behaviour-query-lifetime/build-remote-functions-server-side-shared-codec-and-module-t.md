---
id: 01a1945a-8ae5-7a0e-aa6a-14c0153421b7
title: Build remote functions' server side, shared codec and module transform
ord: 1
tags: ["task"]
fields:
  {
    "holder": "tagma:01a184d8-1b37-7bfc-8899-05d6b3ce2282",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a1945a-6dcb-7f88-ba1f-c9b4d274a460
---
Owners `kit-shared` (remote key, argument encoding, binary form codec), `kit-server` (`server/remote/`, `$app/server` exports, the `ServerOptions.remote` call handler, non-enhanced form posts, per-request cache, refreshes, `requested`), `kit-vite` (`vite/remote.ts` transform, generated options wiring, scan externalization) and `kit-build` (remote prerendering once the build pipeline lands). The shared codec lands first: the client task consumes it.