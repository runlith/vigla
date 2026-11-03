---
id: 01a19414-dc8b-7c9b-a436-73ada23b5169
title: Abort signals follow a reaction evaluation or the current owner's lifetime
ord: 3
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/abort.ts
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/tracking.ts
    symbol: evaluation
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: getReactionSignal
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/tracking.ts
    symbol: resuming
---
During a reaction evaluation, repeated calls to `getAbortSignal` share its signal, including calls through `untrack`, which preserves execution identity. A rerun, disconnection or destruction aborts it with `StaleReactionError`. A rerun does so before its replacement work starts, except a derived's evaluation under a batch's view: it ends the old signal after its run, once the run shows that it replaced the derived's value. A real batch's rerun of an async expression ends the committed run's signal only when that batch commits, and the signals of the pending runs it supersedes at once. A fork's rerun of an effect, and a derived's evaluation whose result stays in a batch's view, get a signal of their own and leave the committed one running ([[389a8e9e]]). A derived's signal also ends when its last reader leaves; its next read evaluates again instead of returning cancelled work. An async expression's run keeps one signal across its synchronous part and the segments it resumes after an `await`, because the work a continuation starts belongs to that run, not to whichever run of the expression is current then. It stays the same aborted signal once the run ends, and a continuation of a run whose batch was discarded or whose expression was destroyed gets an aborted signal even if it asks first after that. A root callback or `owner.run` inside a continuation is not the run's evaluation: it gets its owner's lifetime signal, so work started there does not end with the run. A continuation that asks first after a newer run of its expression replaced it gets a signal released with that newer run. Evaluation identities are weakly keyed, and an isolated historical evaluation has its own resources, so releasing an outgoing cache cannot abort the current computation.

Without a reaction evaluation, Core `getAbortSignal` returns the current owner's lifetime signal, the same signal exposed by `Owner.signal`; a public root callback or `owner.run` therefore has cancellation outside components. That signal ends only when its owner is disposed and stays the same aborted signal afterward. With neither a reaction nor an owner, the client reports `get_abort_signal_outside_reaction`. The Svelte projection selects the reaction-only operation and preserves that diagnostic outside reaction evaluation, including component initialisation. Server context selects the owner lifetime signal and retains its independent, unowned signal outside any scope.
