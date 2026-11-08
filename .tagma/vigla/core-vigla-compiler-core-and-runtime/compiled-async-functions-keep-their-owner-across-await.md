---
id: 01a1b93f-3d4c-7d83-bb93-772fb2b6cbdf
title: Compiled async functions keep their owner across `await`
ord: 25
tags: ["spec"]
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
**Outcome.** In every file Vigla compiles — components, `.svelte.ts` modules and, if it comes, TSX — an `async` function called under an owner runs each segment after an `await` under that same owner, as `$derived(await …)` and template expressions already do. Code after `await` in a service method, a plugin handler or a loader reads context, registers teardowns and creates roots under the owner it was called under, with no `owner.run` written by hand.

**What stands.** Browsers have no async context store, so `carryAcrossAwait` helps only where a platform supplies one ([[fc8a77b5]]). The compiler restores the owner only for reactive expressions ([[fbee9bcb]]). Compiled by `@vigla/svelte` 5.57.3 on 2026-11-08, `export async function load(p) { const a = await p; return getContext('k') + a; }` keeps its `await` untouched, while `$derived(await …)` in the same file becomes `$.save($.asyncDerived(…))`. Since a context read with no owner is refused with `context_without_owner` ([[77d1c74f]]), such code fails loudly after the `await`; the only way through today is `owner.run` after every `await` — the kind of workaround rule [[4786b347]] calls a missing primitive.

**Design to settle.**
- Which owner: the one current when the function was called, captured at entry — never the one current at resumption.
- Reach: only functions the compiler sees. Uncompiled `.ts` keeps `owner.run`; whether a package's plain `.ts` importing `vigla` gets compiled belongs to [[8cd5da81]], not here.
- Cost: a capture at entry and a restore per `await`. A function analysis proves reads no owner-scoped state may skip it.
- Server: with a platform store installed the restore is redundant and must agree with the store.
- Batches: restoring the owner restores no batch; a resumed segment writes into the open batch, as an event handler does.
- Async generators and `for await` are covered or excluded explicitly.

**Acceptance.**
- An own sample: an `async` service method with two `await`s reads context set on its owner after each, on the client with no platform store and on the server.
- A function called with no owner still has none after `await`.
- Two calls under different owners, their `await`s interleaved, each see their own owner.
- The benchmarks ([[cab271de]]) show the cost within the milestone's performance targets.
