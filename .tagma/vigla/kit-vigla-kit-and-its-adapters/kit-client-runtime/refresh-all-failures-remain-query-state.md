---
id: 01a19480-9f0d-7096-a212-d0f053e9170a
title: Refresh-all failures remain query state
ord: 10
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/client/remote/cache.ts
---
Refreshing retained queries is auxiliary to navigation and successful form reconciliation. The aggregate waits for its selected resources to settle, but a resource's failure stays on that resource; promoting it to the navigation's error path could replace an already committed destination and dispose the tab.