---
id: 01a19e93-ccef-7b2b-a2db-902e4ece65b4
title: An application's unhandled flush failure leaves through its own front end, and settled() and fork() under an owner judge only its application
ord: 32
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a19de0-59b2-7950-bf1d-a0b137f29ce1
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: escape
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/front.ts
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/batch.ts
    symbol: quietFor
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/batch.ts
    symbol: settled
  - kind: symbol
    ref: packages/vigla/src/shared/diagnostics.ts
    symbol: unhandled
---
One scheduler serves every application in a realm: a flush runs whatever work is due, whoever called it. An application is a top-level effect tree. A failure no handler or boundary takes is thrown to the caller in two cases: while an effect is being created synchronously (`root(fn)`, `mount`, a component's initialisation), and outside a flush. Inside a flush it goes to the failing tree's front end through `Reporter.unhandled`, and the flush goes on with the rest of the due work. A staleness check that throws takes the same route. Without that, one application's unhandled error would land in another application's `flushSync()` and cut its flush short. The native front end hands the error to the host's `reportError`, or rethrows it from a microtask where the host has none, as an exception in an event listener is reported. The Svelte adapter's reporter rethrows into the flusher, because upstream pins `flushSync()` throwing (`error-recovery`, `effect-loop-infinite`, the signals depth checks). A tree's front end is the entry that created it:
- public `root()` and `effect.root()` with no owner, and `mount`, `hydrate` and `render` without a format, are native;
- `mount`, `hydrate` and `render` given a format belong to that format's front end;
- an effect root created under an owner takes that owner's front end;
- a tree created through an internal entry with no owner, such as `$effect.root` at module level, uses the realm default reporter.

The last case is what keeps upstream's signals tests, which run outside any mount, throwing.

`settled()` called under an owner waits only for the counted work of that owner's top-level tree. Outside any owner it waits for all work in the realm, as upstream's does. `fork()` is refused while a flush runs. Under an owner, it is also refused while the open batch has queued work in that owner's application; outside any owner, while any batch is open. Only the admission decision is scoped: an admitted fork still flushes the open batch synchronously, other applications' work included, since the scheduler is shared.

Deferred tasks drained between batches, such as an `{#await}` pending branch, still throw out of the flush that drains them.
