---
id: 01a193c3-2fe5-7a87-bad5-d31ab1fa8c7e
title: Async setup thunks box their result to preserve nested promises
ord: 6
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/compiler/client/asynchronous.ts
  - kind: file
    ref: packages/vigla/src/compiler/server/asynchronous.ts
  - kind: file
    ref: packages/vigla/src/runtime/dom/async.ts
  - kind: symbol
    ref: packages/vigla/src/compiler/server/script.ts
    symbol: asyncThunk
  - kind: symbol
    ref: packages/vigla/src/compiler/client/blocks.ts
    symbol: awaitCode
  - kind: symbol
    ref: packages/vigla/src/compiler/server/blocks.ts
    symbol: awaited
---
An expression containing an await may still evaluate to a promise, as `(await input).pending` does. Generic async setup waits for the explicit await operations, not that final promise: the thunk returns a non-thenable box and consumers unwrap its value. Lifting individual awaits instead would change evaluation order around calls and assignments. An await block instead owns its whole input promise through its pending, then and catch arms. The client passes an unboxed async thunk directly to `awaited`; the server invokes the same unboxed form without waiting for it. Generic setup would hold the enclosing boundary pending and add a hydration range the await block does not own.