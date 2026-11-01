---
id: 01a19558-ef1c-7409-90cb-600a6376f0a7
title: Native action errors belong to the destination's page boundary
ord: 11
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/server/page.ts
  - kind: file
    ref: packages/kit/src/server/load.ts
---
An action can be submitted from another page. Its failure must retain successful destination layouts and their data so the destination's nearest error component has the same context as a failed page load; handling it before those layouts load would select the root error page instead.