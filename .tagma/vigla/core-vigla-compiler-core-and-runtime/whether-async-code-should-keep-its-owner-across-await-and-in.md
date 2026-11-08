---
id: 01a1b93f-3d4c-7d83-bb93-772fb2b6cbdf
title: Whether async code should keep its owner across `await`, and in what explicit form
ord: 25
tags: ["idea"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a18776-8e37-7bdc-93a5-7dad4786b347
  - kind: relates
    to: 01a1877e-fd98-7ad3-8502-952177d1c74f
  - kind: relates
    to: 01a19562-da29-716c-baa8-d5d4fbee9bcb
---
**Question.** Should Vigla let async code keep its owner across `await` without `owner.run`, and in what form?

**What stands.** Browsers have no async context store, so `carryAcrossAwait` helps only where a platform supplies one ([[fc8a77b5]]). The compiler restores the owner, and reading, only for reactive expressions ([[fbee9bcb]]). Compiled by `@vigla/svelte` 5.57.3 on 2026-11-08, `export async function load(p) { const a = await p; return getContext('k') + a; }` keeps its `await` untouched while `$derived(await …)` in the same file becomes `$.save($.asyncDerived(…))`. After that `await` the function runs under no owner, a context read there is refused ([[77d1c74f]]), and `owner.run` re-enters the owner explicitly.

**Constraints any form must meet.**
- `.svelte` semantics stay upstream's. Upstream's `async-effect-orphan`, a contract entry Vigla passes, requires `$effect` after `await` in an async function called at init to throw `effect_orphan`, which holds only because the owner is gone there. An implicit restore in `.svelte` files breaks it and gives `.svelte` code a meaning upstream does not have.
- Restore the owner, never the reaction: upstream's `async-reactivity-loss*` samples pin that reads after an `await` in an async function stay untracked.
- One rule for an owner disposed, or an effect run ended, before resumption — refuse, run ownerless, or drop the continuation through `owner.signal`. Today the APIs disagree there: `onDestroy` runs at once, `root` and `owner.run` throw, context answers stale values.
- Leave the owner found at each suspension and on a throw, and say what `.then` continuations get.
- Cost is measured by an await-in-a-loop micro benchmark: the benchmarks of [[cab271de]] hold no compiled async function with an `await`.

**Forms.**
- An explicit opt-in on the function — a directive or a rune — at no cost to other code and with no compatibility break.
- A generator runner under an owner, in the style of `Effect.gen`, which also works in uncompiled `.ts`.
- Nothing new: `owner.run` after each `await` stays the public way.

**Before a spec.** A consumer that needs it, measured. Layer resolves its dependencies when a service is built, and Kit probes for the owner explicitly; neither needs it today.
