---
id: 01a1a170-93b5-72c7-a885-0f280cc265ee
title: Executed parents join a data response even when the browser did not invalidate them
ord: 23
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/kit/src/server/data.ts
    symbol: dataResponse
---
A child's `await parent()` can execute ancestors the browser marked reusable. Omitting those fresh ancestor results would merge stale parent fields with child data computed from newer values; discovering those executions must still let an independent redirect end the response without waiting for other loads.