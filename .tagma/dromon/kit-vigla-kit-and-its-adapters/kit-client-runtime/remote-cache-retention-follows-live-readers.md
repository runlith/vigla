---
id: 01a19471-a536-781a-8f76-485aeb7798f7
title: Remote cache retention follows live readers
ord: 5
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/client/remote/cache.ts
  - kind: file
    ref: packages/kit/src/client/remote/query.ts
  - kind: file
    ref: packages/kit/src/client/remote/live.ts
---
Reactive readers retain query entries through the core's `createSubscriber`, including services and detached roots. Its microtask-deferred release lets a rerun reuse the same key while changed arguments release obsolete keys. Plain owned reads retain an entry for their owner's run with the same deferred release; ownerless reads take no reader lease. Pending query requests still share one resource by remote key, so simultaneous handler and owned reads join the same flight. Its transient identity ends on success or failure; a settled resource remains indexed only while an owned reader holds it. The last reader's release ends a live stream, and tab disposal aborts outstanding HTTP work.