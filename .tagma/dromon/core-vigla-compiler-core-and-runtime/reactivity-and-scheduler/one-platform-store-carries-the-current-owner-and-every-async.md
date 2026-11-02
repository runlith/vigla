---
id: 01a19e89-ba45-787d-bffe-c704fc8a77b5
title: One platform store carries the current owner and every async variable across `await`
ord: 31
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1877e-fd98-7ad3-8502-952177d1c74f
sources:
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/carried.ts
---
JavaScript gives no hook where a function resumes after `await`, so a value set synchronously cannot reach the continuation. Only the platform's async context can carry it: `AsyncLocalStorage` today, TC39 `AsyncContext` later. The core is Web-only and cannot create one, so `carryAcrossAwait(store)` installs the store its caller owns. Kit's dev server, preview, build runtime and adapters each create that store once per process.

The store carries one frame. Its first slot holds the current owner, and each `AsyncVariable` has a slot of its own. `owner.run` and `AsyncVariable.run` copy the frame with their own slot replaced and run inside the copy. Nested runs therefore inherit every other slot, and a continuation sees the frame of the run that created it. One store serves every variable because the platform's `run` is the costly part of a call.

A realm admits one store. Installing the same store again does nothing; installing a different one refuses with `async_store_conflict`. Replacing the store would strand every continuation still carrying a frame of the old one, and silently keeping the first would let a caller believe its own store is in use.

Without a store, every run is synchronous-only and costs a direct call. `owner.run` sets the synchronous owner as it always did. An `AsyncVariable` holds its value only for the synchronous extent of `run`, so `get()` after `await` reads `undefined`.

`AsyncVariable` keeps the shape of TC39 `AsyncContext.Variable` — `run(value, fn)` and `get()` — so it can later sit on native async context unchanged. It is public on the client and server entries; only the server entry can install a store.
