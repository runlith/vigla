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
Queries remain reusable while a run reads them, including service and detached-root readers. Per-run releases wait one microtask: a rerun reading the same key keeps its resource, while changed arguments drop the key no longer read. Plain owned reads last with their owner's run; ownerless reads hold nothing. The last reader's release ends a live stream, and tab disposal aborts outstanding HTTP work.