---
id: 01a19c1b-1f05-72a4-b842-6a297dd7c512
title: A locally assigned prop default resets after the parent supplies a value
ord: 7
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/props.ts
    symbol: prop
---
A local assignment remains visible while the parent keeps the prop undefined, including unrelated spread updates. Once the parent supplies a defined value, returning to undefined uses the declaration's original default; retaining the local assignment there would make the default depend on an earlier child edit. Lazy defaults keep their own reactive computation.