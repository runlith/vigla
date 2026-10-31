---
id: 01a19411-bd0e-7d82-8c1c-d1003fa6b706
title: Published hydration data is retained only by live consuming roots
ord: 16
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/data.ts
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/mount.ts
    symbol: hydrate
---
Each hydration root captures the input map of its window and format. Roots sharing that map retain it until the last one ends, when the published map and the root's input reference are released; a built root rejected by hydration validation is destroyed too. This keeps delayed initialization and simultaneous roots working without letting a failed or unmounted tree supply stale values to a later hydration.