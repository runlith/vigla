---
id: 01a19c52-fb3c-7f42-b8c7-c20282c361a3
title: Retain unclaimed remote hydration seeds for late tab readers
ord: 13
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1945b-1c58-71fb-adba-35b832991389",
    "status": "done"
  }
edges:
  - kind: implements
    to: 01a1945a-6dcb-7f88-ba1f-c9b4d274a460
---
Give the remote cache its own core hydration input reader under the tab owner, retained until tab disposal, so queries first read after startup reuse server-published nodes without extending ordinary startup hydration. Consume each remote hydration seed once so releasing a query's last reader cannot replay stale SSR data. Prove both through the public client startup and query path, preserving ordinary reader eviction and the server publication fix.