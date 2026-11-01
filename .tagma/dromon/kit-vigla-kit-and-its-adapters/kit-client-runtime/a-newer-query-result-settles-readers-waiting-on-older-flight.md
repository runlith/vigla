---
id: 01a19471-a5a9-7366-a16d-5415bd649418
title: A newer query result settles readers waiting on older flights
ord: 6
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/client/remote/result.ts
  - kind: file
    ref: packages/kit/src/client/remote/query.ts
---
Refreshes can overlap, and a mutation's side-channel update can arrive before the query request it supersedes. Superseded readers settle on the accepted value rather than the later arrival order, so a stale response cannot replace a mutation's refreshed value or keep an awaiting component suspended.