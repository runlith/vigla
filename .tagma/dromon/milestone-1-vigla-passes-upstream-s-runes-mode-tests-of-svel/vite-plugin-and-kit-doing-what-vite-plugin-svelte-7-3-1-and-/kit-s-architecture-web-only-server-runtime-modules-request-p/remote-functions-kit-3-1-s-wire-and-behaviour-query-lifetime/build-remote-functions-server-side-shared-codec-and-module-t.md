---
id: 01a1945a-8ae5-7a0e-aa6a-14c0153421b7
title: Build remote functions' server side, shared codec and module transform
ord: 1
tags: ["task"]
fields:
  {
    "holder": "tagma:01a193e2-1f81-73bf-bca7-d1170e1158da",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a1945a-6dcb-7f88-ba1f-c9b4d274a460
---
Owners `kit-shared` (remote key, argument encoding, binary form codec), `kit-server` (`server/remote/`, `$app/server` exports, the `ServerOptions.remote` call handler, non-enhanced form posts, per-request cache, refreshes, `requested`), `kit-vite` (`vite/remote.ts` transform, generated options wiring, scan externalization) and `kit-build` (remote prerendering once the build pipeline lands). The shared codec lands first: the client task consumes it.