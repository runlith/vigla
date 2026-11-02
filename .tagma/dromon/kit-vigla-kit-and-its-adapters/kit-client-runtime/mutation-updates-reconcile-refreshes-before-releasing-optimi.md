---
id: 01a19471-a5e6-773d-a249-3eed725304c1
title: Mutation updates reconcile refreshes before releasing optimistic overrides
ord: 7
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/client/remote/cache.ts
  - kind: file
    ref: packages/kit/src/client/remote/command.ts
  - kind: file
    ref: packages/kit/src/client/remote/form.ts
  - kind: file
    ref: packages/kit/src/client/remote/updates.ts
---
A command or successful form response can satisfy query refreshes in the same flight, so its refreshed nodes enter active resources before the optimistic layer is removed. A form that failed validation leaves requested refreshes alone; a successful response that omitted an unignored requested key fails that query rather than leaving stale optimistic data.