---
id: 01a193c3-2fe5-7a87-bad5-d31ab1fa8c7e
title: Async template thunks box their result to preserve nested promises
ord: 6
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/compiler/client/asynchronous.ts
  - kind: file
    ref: packages/vigla/src/compiler/server/asynchronous.ts
  - kind: file
    ref: packages/vigla/src/runtime/dom/async.ts
---
An expression containing an await may still evaluate to a promise, as `(await input).pending` does in an await block. Async setup waits for the explicit await operations, not that final promise: the thunk returns a non-thenable box and consumers unwrap its value. Lifting individual awaits instead would change evaluation order around calls and assignments; returning the expression directly would assimilate its final promise and could prevent pending content from rendering.