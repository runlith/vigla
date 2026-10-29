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
**One mode.** Async is the only scheduler mode, with no flag: what runes samples expect with upstream's async mode on is the reference. `flushSync`, `tick`, `settled`, `fork`, `untrack` and boundaries with `pending` keep upstream's public behaviour.

**Invariants**, each a test of Dromon's own:
- a value already on screen is never reverted for another batch;
- an effect under a guard never runs while the guard is false, including when a teardown during the same flush writes the guard;
- a reaction that read a stale value reruns at commit;
- an effect scheduled onto a batch is never dropped by a rebase;
- an effect of a detached root — `$effect.root` created outside any component, without reactive context — is scheduled and committed like a component's; creating such a root without the caller's reactive context is public API;
- once an unmounted tree's flush settled, the runtime holds no state of it.

**Traps.** The defects behind hunks 2, 5, 6, 7, 8, 9 and 10 of runlith's `svelte@5.57.0` patch (tagma repository, `patches/README.md`) and the window crash of 2026-10-29 — an effect under a `TopBar`-shaped guard reading a `null` seam — rewritten as plain components without `@runlith/layer`, each run on upstream 5.57.3 with async on: red there makes it a fixed defect and a difference; green there makes it a regression test.

**Acceptance.**
- Every invariant has a test, green on Dromon.
- Every trap is green on Dromon, with its result on upstream recorded beside it.
- The runtime-runes contract passes.
