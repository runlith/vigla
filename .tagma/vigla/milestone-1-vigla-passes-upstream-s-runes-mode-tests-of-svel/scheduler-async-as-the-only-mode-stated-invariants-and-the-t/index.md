---
id: 01a185b6-09f2-796e-90b2-9fac9d5e3831
title: "Scheduler: async as the only mode, stated invariants and the traps of runlith's Svelte patch"
ord: 3
tags: ["spec"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a1852f-ba89-7089-9ac3-30ed66da7f99
---
**One mode.** Async is the only scheduler mode, with no flag. `flushSync`, `tick`, `settled`, `fork`, `untrack` and boundaries with `pending` behave as the runes contract samples pin them with async on. A contract sample that contradicts an invariant below becomes a difference naming that invariant.

**Invariants**, observable through public API, each a test of Vigla's own:
- Once the DOM shows a value of a source, no later DOM update or effect in any batch observes an earlier value of that source.
- A block — `{#if}`, `{#each}`, `{#key}`, `{#await}`, `{@render}`, a dynamic component — never runs the template updates or effects of a branch its current value no longer selects, including when that value is written by a teardown or an effect in the same flush; the leaving branch's teardowns run.
- Every effect and derived that read a source runs again with the source's final value before `settled()` resolves, whenever that value differs from what it read — a write in another batch, a merge or a rebase included.
- An `$effect.root` created outside any component is scheduled and committed as a component's effects are.
- Once an unmounted tree's flush settled, the runtime holds no state of it.

Creating a root without the caller's reactive context — what runlith's patch exports `without_reactive_context` for — is a public primitive of this milestone ([[8191e72f]]).

**Traps.** Rewritten as plain components without `@runlith/layer`, each run on upstream 5.57.3 with async on: red there makes it a fixed defect and a difference; green makes it a regression test. From runlith's tagma repository:
- hunk 7: `packages/layer/src/svelte/effect-self-invalidation.svelte.test.ts`;
- hunk 10: `packages/layer/src/svelte/nested-eager-flush.svelte.test.ts`, `seat-release.svelte.test.ts`, `passed-guard.svelte.test.ts` (the `TopBar`-shaped window crash of 2026-10-29) and the app's `apps/tagma/app/src/lib/features/threads/Column.svelte.test.ts -t "leaves when the page"`;
- hunks 5 and 6: `patches/svelte@5.57.0.off/packages/layer/src/svelte/time-travel.svelte.test.ts` (`pending`, `blocking`);
- hunk 8: `patches/svelte@5.57.0.off/packages/layer/src/svelte/rebase.svelte.test.ts`;
- hunk 9: `patches/svelte@5.57.0.off/packages/layer/src/svelte/branch-removal.svelte.test.ts`.

Hunk 2 (`Batch.schedule` bailing on a branch whose `CLEAN` bit is cleared) has no trap in tagma: `patches/README.md` proves it by a downstream e2e, through a second `#process` of a committed batch, a path 5.57.1 removed when it moved the marking into `#resolve`. Its trap is Vigla's own `harness/samples/own/runtime/detached-root-marked`. One batch closes an `{#if}` branch and dirties an effect of an `$effect.root` created inside that branch. The traversal skips the closing branch with the root's path still marked, and the commit detaches the root as an independent root whose `CLEAN` bit stays cleared. On upstream 5.57.3, and on 5.57.0 in both modes, nothing under that root runs again. With hunk 2 applied to 5.57.0's `schedule`, or ported to 5.57.3's `#resolve`, the next write under the root runs both its effects; the effect the closing batch dirtied waits for that write either way. Those runs were made in scratch, outside the harness, and not kept.

**Acceptance.**
- Every invariant has a test, green on Vigla.
- Every listed trap is green on Vigla, with its result on upstream recorded beside it.
- The runtime-runes entries pass.
