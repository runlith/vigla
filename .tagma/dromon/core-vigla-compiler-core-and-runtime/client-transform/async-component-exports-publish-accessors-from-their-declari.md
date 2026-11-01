---
id: 01a19470-3928-7ae3-b35e-b863abb59d83
title: Async component exports publish accessors from their declaring scope
ord: 12
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/compiler/client/exports.ts
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/async.ts
    symbol: ExportsCell
---
An async instance script owns its locals inside the continuation, while the mounted instance must return a stable public surface immediately. Forwarding accessors read a reactive publication cell instead of referring across that lexical boundary; initialization publishes the real accessors and applies queued writes, so reflected defaults appear when ready and early external writes are not lost.