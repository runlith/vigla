---
id: 01a19471-a697-70ca-9f91-49d346a663ac
title: Live-query consumers share a latest-value stream across transport reconnections
ord: 9
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/client/remote/channel.ts
  - kind: file
    ref: packages/kit/src/client/remote/live.ts
---
A transport failure after the first value preserves that value while reconnection is scheduled; an explicit HTTP failure or completed stream ends automatic iteration until an explicit reconnect. Each iterator sees the current value and then its newest pending value, allowing slow consumers without turning the live state stream into an unbounded event log.