---
id: 01a1868a-e2b1-75a8-92fb-02edaa9fb09b
title: "A batch settles structure before content: writes during structure and commit, teardowns' included, join it"
ord: 1
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fac9d5e3831
sources:
  - kind: file
    ref: packages/dromon/src/runtime/reactivity/batch.ts
  - kind: file
    ref: packages/dromon/src/runtime/reactivity/effects.ts
  - kind: file
    ref: packages/dromon/src/runtime/dom/blocks.ts
---
A batch is the unit of commit: the writes made since the last flush, the effects they dirtied, the structure changes its blocks register for commit and, once async work exists, the work still pending in it. Writes made outside a flush go to the one open batch, created by the first write and flushed at the next microtask or by `flushSync`.

**What a flush sees.** Processing a batch evaluates against its view: each source's committed value overlaid with the batch's own writes. While only one batch exists that view is every source's newest value, which is also what code outside a flush reads. A batch held by async work never sees another uncommitted batch's writes, and a later batch that wrote a source an earlier held batch also wrote is merged into it and commits with it, so writes to one source reach the DOM in the order they were made and no view holds a value older than what the DOM shows (invariant 1). A batch sharing no source with a held batch commits alone, as soon as its own work settles.

**Queued, then resolved.** Scheduling an effect only appends it to the batch receiving the write; the batch marks the path from each queued effect to its root when it starts a pass and clears the marks in the same traversal. Marks one batch leaves on the shared effect tree are therefore never seen by scheduling into another, and scheduling never assumes a batch exists — it creates the open one, as the trap of an effect writing what it read and flushing in the same run requires.

**Phases** of one batch's flush:
1. *Structure* — the roots holding queued effects are traversed in creation order; a block whose dependencies changed runs and decides which branches stand. A leaving branch is marked inert, so this traversal, later passes and the content phase skip it; an entering branch or row is built off-screen with its own effects run. Dirty template effects met on the way are collected.
2. *Commit* — the registered structure changes apply: leaving branches lose their nodes and are destroyed, their teardowns running; entering ones are inserted and rows moved.
3. *Content* — the collected template effects run in collection order, each only if it is still alive, not inert and still stale; one re-dirtied while running is queued again after its run, never re-entered.
4. *Effects* — user effects run after content, in tree order.

Writes made during structure or commit — a teardown's included — join the batch being processed, and the flush repeats structure and commit until nothing is queued, bounded at 1000 passes, before content runs. A value a teardown writes thus deselects its branches before any content of them runs (invariant 2). Upstream 5.57.3 sends writes made after traversal, commit-time teardowns included, to a new batch processed after the current batch's effects have run (`batch.js`, `#process`): the shape of the passed-guard and seat-release traps, where a guard a teardown cleared still let the deselected branch's effects run.

Writes made during content or effects belong to the next batch, which the same flush processes after this one. A block's first run — inside a branch being built off-screen, or a mount — inserts at once, since nothing of it is on screen.

**Nested `flushSync`.** Called during structure or commit, as from a teardown, it returns without processing: the batch in progress is finished by the outer flush. Called during content or effects, it processes the next batch at once.

**Rebase.** When a batch commits, every other open batch is rebased onto the new committed world: its blocks and async work that read a source the commit changed run again under its updated view before it may commit, and `settled()` resolves only once no open batch remains (invariant 3).

**Roots.** A mount and an `$effect.root` created outside any component are alike top-level effects: queued, traversed and committed by the same phases, ordered among themselves by creation (invariant 4).

**No state of unmounted trees.** The runtime keeps no registry of trees: a batch is dropped once processed, a root is reachable only from its mount, effects and deriveds unsubscribe from their sources when destroyed, and `mount` keeps instances in a `WeakMap`. Once an unmounted tree's flush settled nothing in the runtime references it, so a target resets nothing between samples (invariant 5).

Not built yet: held batches and their views, merging, rebase, `settled()`, forks and user effects. The single-batch path above — queueing, the structure and commit loop, content, nested `flushSync` and roots — is what the code runs.
