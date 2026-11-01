---
id: 01a187ef-05b4-773e-9dd0-78c94043117b
title: A leaving branch plays the outros local to its block and stays until they end; a local intro plays only on its block's update
ord: 1
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a187bd-ab40-7693-b307-bc614c3b5c2e
sources:
  - kind: file
    ref: packages/vigla/src/runtime/transitions/manager.ts
  - kind: file
    ref: packages/vigla/src/runtime/dom/branches.ts
  - kind: file
    ref: packages/vigla/src/runtime/dom/list.ts
---
A transition belongs to the block whose branch renders its element. When a branch leaves, the blocks ask `pause` to play the outros of that branch's own elements and of those rendered through components, dynamic `{@render}` or component blocks and `<svelte:element>`'s tag block, which are transparent. A nested `{#if}`, `{#each}`, `{#key}` or `{#await}` makes everything under it non-local, so only its `|global` transitions play. Symmetrically, a local intro plays only when its nearest non-transparent block builds the branch on an update, never on that block's first run, and every intro waits for the mount's `intro` option, `true` unless set. Upstream 5.57.3 reads the same rules from its effect flags (`EFFECT_TRANSPARENT`, `REACTION_RAN`); Vigla takes them from the block that is building: `building` around each branch or row a block creates, `seeThrough` for the transparent swaps, and component instance owners (root effects linked under a branch) counted as transparent.

A paused branch or row stays in the DOM and its key stays known, hidden from every batch so nothing in it updates while it leaves, until all its outros finish; then it is destroyed, or stashed if a held batch still selects it. Selected again before that, it resumes in place without rebuilding: a bidirectional transition reverses from where it is, while an out-only transition resets and starts afresh if the branch leaves again. An each row entering or moving is placed right after the row before it in the new order, ahead of rows still leaving there, as upstream places it; the list keeps a start node of its own — the server's open marker when hydrated, else an empty text node — so the first row has a position to follow. With `animate:`, each list measures its retained rows and rows starting an outro before it pins, stashes or reorders any of its rows. Retained rows animate a task later; an outgoing element with no browser-reported animations is taken out of flow and offset with an inline transform. An element with an animation keeps its existing positioning because animated styles may override that offset.

Managers and movers are kept in `WeakMap`s keyed by the effect that rendered the element, so a destroyed tree leaves none behind.
