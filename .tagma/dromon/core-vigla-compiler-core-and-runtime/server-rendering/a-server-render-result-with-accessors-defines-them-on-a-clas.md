---
id: 01a19eed-08bd-7656-9f0e-419432169de2
title: A server render result with accessors defines them on a class prototype, never in an object literal
ord: 10
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a19ec1-5a9b-71fc-864f-eb07926d5808
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/server/render.ts
    symbol: Pending
  - kind: file
    ref: packages/svelte/src/entries/server.ts
---
A render's result is created once per request, and its `head`, `body`, `html` and `hashes` reads must not keep the render alive. Built as an object literal with `get` accessors, every call defined new accessor closures that share `render()`'s function context, and through it the output tree, the scope and every string the render pushed. V8 retains such per-object accessors through structures only a full collection clears. Every render's output therefore survived each minor collection until the next major one, and server rendering paid for promoting all of it in GC time. Accessors on a class prototype exist once, and the instance holds the render's state in a private field, so a dropped result dies at the next minor collection.

The accessor-bearing results are the core's pending result for asynchronous renders, and the adapter's synchronous wrapper and the object an awaited adapter render resolves to. The core's synchronous result and the values its renders resolve to stay plain data objects: a data `then` method and data fields do not retain this way.
