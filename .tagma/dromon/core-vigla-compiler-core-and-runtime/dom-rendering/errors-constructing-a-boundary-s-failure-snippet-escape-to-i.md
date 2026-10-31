---
id: 01a19464-5ee1-73e5-9562-08bb99462b52
title: Errors constructing a boundary's failure snippet escape to its parent
ord: 20
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/boundary.ts
---
Retrying the same failure snippet while constructing it cannot make progress and can refill the deferred task queue indefinitely. Construction therefore routes errors outward, while the completed failure snippet keeps the boundary for its later reactive updates.