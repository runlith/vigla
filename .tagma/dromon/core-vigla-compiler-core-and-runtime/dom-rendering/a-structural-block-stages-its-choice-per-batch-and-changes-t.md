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
    ref: packages/vigla/src/runtime/dom/branches.ts
  - kind: file
    ref: packages/vigla/src/runtime/dom/list.ts
---
A block's rerun decides what *its batch* shows, not what the page shows: `{#if}`, `{#key}`, dynamic components and `{@render}` record the chosen key per batch in a `Branches`, `{#each}` the chosen rows in a `List`, and each registers a commit and a discard callback with that batch. The DOM changes only when that batch commits, so a held batch's structure lands with its content and an earlier batch committing meanwhile shows its own choice, never the held one's. A batch that reruns the block again before committing replaces its own staged choice; the same block may hold different choices for several held batches at once.

A branch or row stays alive while it is on screen or some uncommitted batch's choice still names it: a branch a committing batch leaves but a held batch selected is moved into a fragment (`stash`) and reinserted when that batch commits, and the rest are destroyed. A discarded batch prunes what only it needed. Within the batch that stages a choice, the branches and rows it leaves are skipped, so their effects never run for a value that no longer selects them (invariant 2 of [[9d5e3831]]).

Rows are reconciled at commit against the order on screen: a row whose relative order survives stays where it is, and only the rest move, chosen by the longest increasing run of retained positions, so a reorder costs the minimum DOM moves.

A block run outside any batch's structure phase — its first run, or one with no batch being processed — applies at once, since nothing of it can be held.
