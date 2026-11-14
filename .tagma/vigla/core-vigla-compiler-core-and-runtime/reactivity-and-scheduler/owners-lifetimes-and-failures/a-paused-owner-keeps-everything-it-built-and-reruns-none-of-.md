---
id: 01a1d834-a22d-77fb-9b84-056eac8103d5
title: A paused owner keeps everything it built and reruns none of its effects until resumed
ord: 9
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1877e-fd98-7ad3-8502-952177d1c74f
  - kind: relates
    to: 01a1d810-371d-778f-9b2c-36dbd78e5d31
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/batch.ts
    symbol: revive
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/owners.ts
    symbol: pausing
---
An application keeps what a person returns to — a page, a column, a pane — built while it is off screen, because rebuilding it costs more than showing it. Kept that way it still reran every effect its state reached: text, lists and blocks nobody could see. `owner.pause()` stops that and `owner.resume()` brings the subtree current; `owner.paused` says which holds.

**What stops.** Every effect under the owner — template updates, structural blocks, `$effect` and `watch`, in nested components and roots — is skipped by every batch while the owner is paused. State it reads keeps changing, and a derived it declared still answers a reader outside it with current values. Nothing is torn down: DOM, scroll positions, subscriptions and the services the subtree took stay as they were. An effect *created* under a paused owner, by `owner.run` or a resumed `await`, still runs its first time; only reruns wait.

**What resume does.** Each effect that went stale runs once, with the values current then, in the flush already running or the next one — before the screen is painted. A `watch` answers once if its value differs from the one it last answered and gets that one as `previous`; a value that left and came back is no change.

**The pause lands after the flush that carried it.** A pause requested while a change is being applied takes hold a microtask later, so everything that change made due inside the subtree still runs: a frame told it is leaving the screen reacts to that, then freezes. Pausing at once would leave it to chance — the order of effects in the tree — whether the subtree saw its own hiding, and its `watch` would then answer nothing on return. A `resume` before the pause lands cancels it.

**Pending work stops holding the screen.** Async work under a paused owner no longer counts toward holding a batch, and landing a pause asks for a flush, so an update that a now-hidden page's `await` was holding is released for the rest of the application.

It is the scheduler's existing concealment — the flag a leaving branch carries while its outro plays — given to owners. No second mechanism was added: the traversal that skips a leaving branch skips a paused owner, and resume gathers the stale effects of the subtree the way a reselected branch does. While any owner is paused, each effect a batch settles checks its ancestors for concealment, a walk as deep as the tree.

Disposing a paused owner runs its teardowns as usual. On the server, where no effect reruns, pausing only records the state.
