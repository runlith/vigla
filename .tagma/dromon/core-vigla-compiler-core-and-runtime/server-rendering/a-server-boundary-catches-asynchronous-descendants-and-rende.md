---
id: 01a193c2-5fc8-7299-88ae-63101add92a5
title: A server boundary catches asynchronous descendants and renders failure under its captured context
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/server/render.ts
---
Async rendering settles through the output tree so a rejected descendant reaches its enclosing boundary and partial body, head and title content can be discarded together. Failure rendering restores the context captured at the boundary and no longer uses that boundary's recovery handler, so errors in the failure snippet reach an outer boundary. A server error propagates unless `transformError` returns a replacement. An asynchronous transform or failure snippet keeps `render()` awaitable; synchronous getters reject asynchronous work, while awaiting returns its completed output.