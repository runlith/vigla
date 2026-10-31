---
id: 01a19431-bfe2-7927-a896-026c18978c18
title: A server derived caches only when created inside a render
ord: 5
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/server/render.ts
    symbol: derived
  - kind: symbol
    ref: packages/vigla/src/runtime/server/context.ts
    symbol: isRendering
---
A module's derived can outlive many requests, so it re-evaluates on each read rather than retaining the first request's value. A derived created during rendering keeps a lazy cache for that instance, avoiding repeated work across its reads. An explicit non-nullish override masks the computed value; assigning a nullish value clears the override.