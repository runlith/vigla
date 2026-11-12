---
id: 01a187bd-ab40-7693-b307-bc614c3b5c2e
title: A structural block stages its choice per batch and changes the DOM only when that batch commits
ord: 7
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1868a-e2b1-75a8-92fb-02edaa9fb09b
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/await.ts
  - kind: file
    ref: packages/vigla/src/runtime/dom/boundary.ts
  - kind: file
    ref: packages/vigla/src/runtime/dom/branches.ts
  - kind: file
    ref: packages/vigla/src/runtime/dom/list.ts
---
A block's rerun decides what *its batch* shows, not what the page shows: `{#if}`, `{#key}`, dynamic components and `{@render}` record the chosen key per batch in a `Branches`, `{#each}` the chosen rows in a `List`, and each registers a commit and a discard callback with that batch. The DOM changes only when that batch commits, so a held batch's structure lands with its content and an earlier batch committing meanwhile shows its own choice, never the held one's. A batch that reruns the block again before committing replaces its own staged choice; the same block may hold different choices for several held batches at once. While any choice is pending, a batch selecting the on-screen branch still records that choice, so another batch cannot remove a branch it needs. A merge transfers the staged choice to the receiving batch, and commit and discard callbacks resolve that batch's alias; an incoming batch's intermediate choice can therefore never overwrite the combined structure pass. A boundary receiving a fork's failure skips its content only in that fork and defers retirement, error transformation, `onerror` and fallback publication until the owning commit; discarding the fork preserves the visible content. Retirement clears its range references and pending visibility before destroying their owners, since destruction settles work synchronously and could otherwise reinsert the content being retired.

A branch or row stays alive while it is on screen or some uncommitted batch's choice still names it: a branch a committing batch leaves but a held batch selected is moved into a fragment (`stash`) and reinserted when that batch commits, and the rest are destroyed. Off-screen content is hidden from batches that did not select it; selecting a branch explicitly admits it to that batch, and committing it makes it visible to later batches. A discarded batch prunes what only it needed. Within the batch that stages a choice, the branches and rows it leaves are skipped, so their effects never run for a value that no longer selects them (invariant 2 of [[9d5e3831]]).

Rows are reconciled at commit against the order on screen: a row whose relative order survives stays where it is, and only the rest move, chosen by the longest increasing run of retained positions, so a reorder costs the minimum DOM moves. A commit that keeps none of the rows on screen, where no row plays an outro and the list's start node and anchor are the first and last children of their parent, empties that parent at once and puts the two nodes back before placing the new rows, rather than removing each old row's nodes, as upstream's controlled each does; the old rows' effects are then destroyed without touching the DOM.

An `{#await}` promise settles under the block's owner without restoring the input's batch or view. Settlement selects the still-live run's branch directly before flushing queued input changes: rerunning the input from a settlement source would instead see a later write and suppress a pending branch whose task came first (`await-pending-destroy`). The pending branch is a deferred `task`: it appears one microtask later only if the promise has not settled by then, or at once when `flushSync` drains the task first. A newer input makes every result of an older promise stale.

Initial construction or hydration applies immediately. Later choices made during structure or commit join that batch's commit waves, so they do not cross a wave's preparation/application boundary; outside those phases they apply immediately.
