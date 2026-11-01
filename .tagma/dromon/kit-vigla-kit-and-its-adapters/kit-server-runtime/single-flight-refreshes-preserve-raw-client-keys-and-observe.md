---
id: 01a1946d-d0cb-7981-8bfc-1183f8c7dc73
title: Single-flight refreshes preserve raw client keys and observe completed mutations
ord: 8
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/server/remote/requested.ts
  - kind: file
    ref: packages/kit/src/server/remote/collect.ts
  - kind: file
    ref: packages/kit/src/server/remote/resource.ts
---
A schema can transform an argument without changing the browser's cache identity. Requested refreshes therefore bind validated input to the original encoded payload. Refresh work is deferred until command or form completion, and the response drains newly discovered refreshes before serializing them, so an early refresh observes later mutations and a subsequent awaited read can reuse the fresh request-cache value.