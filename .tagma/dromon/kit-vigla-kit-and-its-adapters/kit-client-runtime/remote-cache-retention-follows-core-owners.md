---
id: 01a19471-a536-781a-8f76-485aeb7798f7
title: Remote cache retention follows core owners
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
A query used by a service or detached root must remain refreshable after a component that also reads it disappears. The consuming core owner retains the entry until teardown; a read outside an owner contributes no retention. Live streams end when their last retaining owner does, and disposing the tab aborts its outstanding HTTP work.