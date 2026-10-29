---
id: 01a18779-64fa-78e2-a5ec-458f1a1dd2a2
title: Pending work holds its batch unless a boundary shows pending content in its place
ord: 3
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/async.ts
---
The DOM and compiled code hold a batch through one primitive, `work()`: a unit of pending work in the current batch — the one an async continuation restored, the one in its structure or commit phase, else the open one, as for writes — returning the function that settles it once, in whichever batch the first has since merged into. The unit also settles when the owner that started it is destroyed: work whose tree is gone holds nothing, or a promise that never resolves would keep its batch uncommitted forever and every later batch in multi-batch mode. A unit holds its batch unless its owner lies under a branch the batch skips or an off-screen branch the batch did not select, or the owner's boundary chain has a boundary showing its pending content: content not yet on screen cannot be torn by a commit, so the batch commits and the boundary swaps the content in when its own count returns to zero. Once content is on screen, work under it holds the batch, so the old content stays until the new values arrive. Every unit is counted on the owner's nearest boundary, which `$effect.pending()` reads a microtask later.

`asyncDerived(fn)` holds nothing on its first run: the caller that awaits its first value holds the work until what depends on it exists, because a unit settled at resolution would let the batch commit before the template reading the value was created. Each later run is a unit of the batch that ran it, and its value is written into that batch, so two batches awaiting the same expression each commit their own result; a run superseded within its batch or belonging to a discarded fork is dropped, a rejection before the first value rejects the returned promise, and one after it settles its unit and then reaches the boundary.

A `Boundary` is the DOM's, seen here only as its parent, whether it is showing pending content, the count it is told of and the errors routed to it: an effect created under it inherits it, an error thrown by such an effect's run reaches `failed`, and a user effect created while it shows pending content waits until `reveal` runs it in the batch revealing the content. `suspend()` before an `await` and the function it returns after it restore the owner, the batch and that batch's view for the synchronous segment; `resumed()` ends that segment, so a foreign microtask never runs inside a restored context.
