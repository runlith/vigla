---
id: 01a1868a-e2b1-75a8-92fb-02edaa9fb09b
title: A batch settles structure before content, and a held batch never shows another uncommitted batch's writes
ord: 1
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fac9d5e3831
sources:
  - kind: file
    ref: packages/dromon/src/runtime/dom/blocks.ts
  - kind: file
    ref: packages/dromon/src/runtime/reactivity/batch.ts
  - kind: file
    ref: packages/dromon/src/runtime/reactivity/effects.ts
---
A batch is the unit of commit: the writes made since the last flush (each source's value `before` the batch's first write and its own latest value `after`), the effects they dirtied, the structure changes its blocks register for commit, and the blocking work still pending in it. Writes made outside a flush go to the one open batch, created by the first write and flushed at the next microtask or by `flushSync`. A batch whose blocking work is pending after its structure phase is *held*: it keeps its registered structure changes and the effects it collected, stays among the uncommitted batches, and is processed again once its work settles or something queues into it. A *fork* is a batch that holds until `commit()`, its writes kept in `after` alone and never applied to the sources' values.

**What a flush sees.** A source's own value is always its newest write outside forks, which is what code outside a flush reads. While no other uncommitted batch exists a batch evaluates against those values directly; otherwise it evaluates against its view: every other uncommitted batch's writes hidden behind their `before` values, its own `after` values over any later write, a fork's writes visible only in the fork's own view. A derived reached through a hidden source is computed afresh in the view and cached there, never in the derived; a run under a view adds what it reads to its dependencies without dropping any, so a discarded fork or a later commit cannot leave a reaction blind to a source the committed world reads. A batch that commits leaves the uncommitted set, so no later view hides what the DOM already shows (invariant 1); one held only by work under a boundary showing its pending content is not held at all and commits at once.

**Merging.** An open batch that wrote a source an uncommitted held batch also wrote is merged into the earliest such batch when it is flushed, before any of it runs, and commits with it, so writes to one source reach the DOM in the order they were made. A batch sharing no source with a held batch commits alone, as soon as its own work settles. A write made during structure or commit into a source a held batch wrote merges nothing: the newest value is the one every later view shows.

**Shared status.** Dirtiness lives on the shared effect tree, so a batch that defers an effect it collected marks it clean and forces it in every other batch that has it queued, and while uncommitted batches exist a write schedules its reactions into its batch even when another batch already dirtied them. A run that read a write hidden from it is recorded against the hiding batch: it is forced again in this batch once that batch commits, and forced in the hiding batch if that batch still has it queued.

**Queued, then resolved.** Scheduling an effect only appends it to the batch receiving the write; the batch marks the path from each queued effect to its root when it starts a pass and clears the marks in the same traversal, including under a branch it skips. Marks one batch leaves on the shared effect tree are therefore never seen by scheduling into another, and scheduling never assumes a batch exists — it creates the open one, as the trap of an effect writing what it read and flushing in the same run requires.

**Phases** of one batch's flush:
1. *Structure* — the roots holding queued effects are traversed in creation order; a block whose dependencies changed runs and decides which branches stand. A leaving branch is skipped by this batch's traversal, later passes and its content phase; an entering branch or row is built off-screen with its own effects run. Dirty template and user effects met on the way are collected. A held batch stops here.
2. *Commit* — the registered structure changes apply: leaving branches lose their nodes and are destroyed, their teardowns running; entering ones are inserted and rows moved.
3. *Content* — the template effects deferred while the batch was held run first, then the collected ones in collection order, each only if it is still alive and still stale; one re-dirtied while running is queued again after its run, never re-entered.
4. *Effects* — user effects run after content: the deferred ones, then those the traversal met, in tree order, and those created during structure or commit, in creation order. One created during content or effects is queued in the next batch; one created under a boundary showing its pending content waits until the boundary reveals its content. `$effect.pre` effects are content effects: they run at creation and rerun among the template effects in tree order.

Writes made during structure or commit — a teardown's included — join the batch being processed, and the flush repeats structure and commit until nothing is queued, bounded at 1000 passes, before content runs. A value a teardown writes thus deselects its branches before any content of them runs (invariant 2). Upstream 5.57.3 sends writes made after traversal, commit-time teardowns included, to a new batch processed after the current batch's effects have run (`batch.js`, `#process`): the shape of the passed-guard and seat-release traps, where a guard a teardown cleared still let the deselected branch's effects run.

Writes made during content or effects belong to the next batch, which the same flush processes after this one. A block's first run — inside a branch being built off-screen, or a mount — inserts at once, since nothing of it is on screen.

**Nested `flushSync`.** Called during structure or commit, as from a teardown, it returns without processing: the batch in progress is finished by the outer flush. Called during content or effects, it processes the next batch at once. A flush processes uncommitted batches that are ready — work settled, or effects queued into them — in creation order before the open batch.

**Rebase.** When a batch commits, every other uncommitted batch is rebased onto the new committed world: its reactions that depend on a source the commit changed and on one of its own writes, and the runs recorded against the committed batch, are forced in it, so its blocks and async work run again under its updated view before it may commit. A held batch that wrote a source the commit then overwrote gives that source up. `settled()` resolves only at the end of a flush that leaves no open or held batch, forks aside (invariant 3).

**Roots.** A mount and an `$effect.root` are alike top-level effects with no parent: queued, traversed and committed by the same phases, ordered among themselves by creation (invariant 4). `$effect.root` keeps the caller's context and boundary but is never destroyed with the caller.

**No state of unmounted trees.** The runtime keeps no registry of trees: a batch is dropped once committed or discarded, a root is reachable only from its mount, effects and deriveds unsubscribe from their sources when destroyed, and `mount` keeps instances in a `WeakMap`. Once an unmounted tree's flush settled nothing in the runtime references it, so a target resets nothing between samples (invariant 5).
