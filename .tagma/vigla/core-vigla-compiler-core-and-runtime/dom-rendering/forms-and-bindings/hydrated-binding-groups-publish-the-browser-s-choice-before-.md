---
id: 01a19c23-1f85-7e70-b5dc-7003d6db6420
title: Hydrated binding groups publish the browser's choice before a synchronous flush returns
ord: 8
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/bindings.ts
    symbol: bindGroup
---
A user can change a radio or checkbox group before hydration installs its listeners. Reconciliation waits until all group members are registered, but shares the scheduler's drainable task queue so an immediate synchronous flush observes the browser's choice instead of the server's old value. Group sorting uses that same queue to establish DOM order first.