---
id: 01a1852f-ba89-7089-9ac3-30ed66da7f99
title: One async scheduler, no mode flag, written against a contract of invariants
ord: 6
tags: ["idea"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a1852f-ba89-7089-9ac3-30e788b9f5b3
  - kind: relates
    to: 01a1852f-ba89-7089-9ac3-30ec57917054
---
**One mode, no flag.** Dromon has no sync mode and no `experimental.async` switch. Two scheduler models in one runtime are worse than either: upstream skips `#commit` in sync mode because `flushSync` misleads it, with a TODO expecting a regression once non-async mode is removed; Svelte 6 removes the flag ([[88b9f5b3]]).

**Upstream's async model is not ported as it is.** runlith's `svelte@5.57.0` patch in the tagma repository shows four symptoms of one root — batches see different worlds and nothing states what the screen and the effects see:
- time travel reverts, for a neighbour batch, a world the screen already left, and readers of the reverted value never rerun (hunks 5, 6);
- a rebase drops the effects it collected and they stay dirty forever (hunk 8);
- effects of a branch its guard already removed run against the values the guard protected — the `activeId` crashes of Tagma's agents column (hunks 9, 10).

Tagma turned async off on 2026-10-28 because of that model, not because of `await` in markup. Sync mode then crashed the window the next day: a `SeamHandle` effect read a `null` seam under a `TopBar` guard; the mechanism — a teardown write during traversal while the guard above has not rerun — was inferred from `batch.js`, not reproduced when this was written.

**Contract before code.** The scheduler is written against stated invariants, first among them:
- a value already on screen is never reverted for another batch;
- an effect under a guard never runs while the guard is false;
- a reaction that read a stale value reruns at commit;
- an effect of a detached root (a service outside the component tree) is scheduled and committed like a component's ([[57917054]]).

The traps of the patch hunks — in tagma's `packages/layer/src/svelte`, the async-only ones parked in `patches/svelte@5.57.0.off/` — are the contract's first tests.
