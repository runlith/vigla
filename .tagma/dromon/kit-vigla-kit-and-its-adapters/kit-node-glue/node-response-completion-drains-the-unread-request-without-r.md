---
id: 01a193fe-64b6-7d1b-9f6a-d00eb416dd75
title: Node response completion drains the unread request without retaining its body producer
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/node/request.ts
  - kind: file
    ref: packages/kit/src/node/response.ts
---
The Web request body pauses Node input when its queue fills. Finishing the response must remove that producer before resuming the incoming message, otherwise discarded bytes refill an unconsumed queue and pause the connection again. Other data listeners remain attached, and the body's end and error listeners settle any reader that stopped partway through; the response's early close independently aborts the request signal after its body has already been consumed.