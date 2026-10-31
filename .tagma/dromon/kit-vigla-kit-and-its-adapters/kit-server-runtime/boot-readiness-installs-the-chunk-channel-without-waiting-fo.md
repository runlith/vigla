---
id: 01a1942a-9253-7b85-96f3-fc77a807e4f0
title: Boot readiness installs the chunk channel without waiting for initial loads
ord: 5
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/server/document.ts
  - kind: file
    ref: packages/kit/src/server/data.ts
---
`global.ready` waits for the client entry to import and initialize its channel, not for startup to finish: an initial universal load may itself await a deferred chunk. Hydration data and later chunks are thunks so the client can decode them under the tab owner after its init hook, while the server only schedules their delivery. The observable `defer` and `resolve` names remain the wire contract.