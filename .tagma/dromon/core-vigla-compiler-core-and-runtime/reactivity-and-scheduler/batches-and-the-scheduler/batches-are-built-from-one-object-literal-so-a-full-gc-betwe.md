---
id: 01a19f3c-dbb8-7709-8a40-bf22a5fa1612
title: Batches are built from one object literal so a full GC between flushes keeps the scheduler optimized
ord: 7
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a195a3-567a-7025-b99c-22982a93bdf4
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/batch.ts
    symbol: createBatch
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/history.ts
    symbol: beforeOf
---
A batch is a plain record that `createBatch` builds from one object literal, with its history fields first. `History`'s lazily materialized map of prior values is read through `beforeOf`, not a getter.

V8 gives an object literal its map from a boilerplate that the creating function's feedback holds, so the map lives as long as that code is warm. A class with field initializers instead gives each instance its map through a chain of field-by-field transitions, which V8 holds only weakly. Between flushes no batch is alive. A full GC at that point cleared the chain, and every optimized function that had checked a batch's map was deoptimized: `write`, `record`, `mark`, `dirty`, `enqueue`, `traverse`, `settle` and `run`. The first flushes after every major GC then ran unoptimized. Keeping one dead batch alive to pin the map was rejected: it holds a record nothing uses and hides why the map must live. A getter in the literal was rejected too, because it would create a closure per batch and leave the fast literal path.

The same holds for any record the scheduler's hot paths check whose instances can all die between uses. Such a record is built from an object literal, never with `new` on a class with fields.