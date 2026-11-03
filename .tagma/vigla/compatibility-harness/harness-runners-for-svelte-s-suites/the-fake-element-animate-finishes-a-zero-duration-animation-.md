---
id: 01a18616-312e-7aac-965d-4e2c25078391
title: The fake Element.animate finishes a zero-duration animation as soon as its onfinish is set
ord: 7
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fab49056597
sources:
  - kind: file
    ref: harness/src/clock.ts
---
A transition starts by creating a zero-duration placeholder animation and beginning in its `onfinish`. Upstream's test helper queues that callback on the runtime's internal microtask queue, so it still runs inside the `flushSync` that created the transition. A runner cannot reach that queue, and a callback queued on the global `queueMicrotask` would run only after the test's next synchronous statements, so `raf.tick` would start the animation late and with the wrong offset. Calling it synchronously keeps the start inside the same flush; with it the runner passes the same transition entries as upstream's runner, without faking the microtask queue.