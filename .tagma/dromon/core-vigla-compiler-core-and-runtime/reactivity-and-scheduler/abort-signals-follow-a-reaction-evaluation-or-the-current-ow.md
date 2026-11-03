---
id: 01a19414-dc8b-7c9b-a436-73ada23b5169
title: Abort signals follow a reaction evaluation or the current owner's lifetime
ord: 12
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
---
During a reaction evaluation, repeated calls to `getAbortSignal` share its signal, including calls through `untrack`, which preserves execution identity. A rerun, disconnection or destruction aborts it with `StaleReactionError` before replacement work starts. A derived's signal also ends when its last reader leaves; its next read evaluates again instead of returning cancelled work. Evaluation identities are weakly keyed, and an isolated historical evaluation has its own resources, so releasing an outgoing cache cannot abort the current computation.

Without a reaction evaluation, Core `getAbortSignal` returns the current owner's lifetime signal, the same signal exposed by `Owner.signal`; a public root callback or `owner.run` therefore has cancellation outside components. That signal ends only when its owner is disposed and stays the same aborted signal afterward. With neither a reaction nor an owner, the client reports `get_abort_signal_outside_reaction`. The Svelte projection selects the reaction-only operation and preserves that diagnostic outside reaction evaluation, including component initialisation. Server context selects the owner lifetime signal and retains its independent, unowned signal outside any scope.
