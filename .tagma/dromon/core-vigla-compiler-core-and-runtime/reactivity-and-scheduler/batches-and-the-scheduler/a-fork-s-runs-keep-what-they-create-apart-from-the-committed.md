---
id: 01a19eeb-6938-7e83-802a-648f389a8e9e
title: A fork's runs keep what they create apart from the committed runs until the fork commits or is discarded
ord: 6
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1868a-e2b1-75a8-92fb-02edaa9fb09b
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: run
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: promote
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: restoreAside
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/reads.ts
    symbol: refresh
---
A fork reruns blocks and async expressions and evaluates deriveds through its view to preload a state that may never commit. Its runs therefore never take what the committed world's runs own. A fork's rerun of an effect leaves the effect's last real run in place: its children, its teardown, its owned deriveds and its abort signal. What the fork's run creates is kept apart as the fork's draft of that effect, including children created after an `await` in the run's resumed segments. Discarding the fork destroys its drafts. Committing it replaces a real run's state with the draft only where the fork's run is still the effect's latest. An effect the commit reruns replaces both, since a real run destroys every draft of its effect. Branches a block creates stay out of the draft, because blocks stage their branches per batch themselves. The first run of an effect a fork creates is no draft: no real run precedes it, and the effect belongs to the fork from the start.

A derived whose evaluation for a view stays in that view — a fork's, or a run that read a hidden value — likewise keeps the effects and signal of its committed evaluation. The effects the view's evaluation created belong to that batch, and end when the batch ends or when it evaluates the derived again. Under a view, a derived destroys its previous effects after the run instead of before it, because only the run tells whether its result replaces the derived's value.

Without this, a fork that preloads another key stops the committed key's subscription and leaves its own running after a discard. A fork started while a real batch's request is in flight aborts that request, and that batch never commits. Draft children stay linked in the effect tree, so a real batch whose traversal reaches one while the fork is outstanding can still run it.
