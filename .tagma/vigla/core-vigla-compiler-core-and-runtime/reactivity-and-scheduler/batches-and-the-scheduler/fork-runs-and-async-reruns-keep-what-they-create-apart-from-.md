---
id: 01a19eeb-6938-7e83-802a-648f389a8e9e
title: Fork runs and async reruns keep what they create apart from the committed runs until their batch ends
ord: 6
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1868a-e2b1-75a8-92fb-02edaa9fb09b
sources:
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/drafts.ts
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/batch.ts
    symbol: handOver
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: promote
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: restoreAside
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: run
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/reads.ts
    symbol: refresh
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/scheduler.ts
    symbol: traverse
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/settle.ts
    symbol: blocks
---
A fork reruns blocks and async expressions and evaluates deriveds through its view to preload a state that may never commit. Its runs therefore never take what the committed world's runs own. A fork's rerun of an effect leaves the effect's last real run in place: its children, its teardown, its owned deriveds and its abort signal. What the fork's run creates is kept apart as the fork's draft of that effect: its children, including those created after an `await` in the run's resumed segments, and the deriveds it creates with the effects their evaluations create. Discarding the fork destroys its drafts. Committing it replaces a real run's state with the draft only where the fork's run is still the effect's latest. Either way the replaced children go in the order a rerun releases them, the newest application root first. An effect the commit reruns replaces both, since a real run destroys every draft of its effect. Branches a block creates stay out of the draft, because blocks stage their branches per batch themselves. The first run of an effect a fork creates is no draft: no real run precedes it, and the effect belongs to the fork from the start. A real batch's rerun of an async expression is a draft of that batch as well, promoted when it commits. Otherwise a held batch, such as a pending navigation, would end the shown run's subscriptions and signal for as long as it waits, and the screen would show data that nothing keeps current. Such a rerun releases every other draft of the expression, as a real rerun always has, so a superseded request is still aborted at once; only the committed run's state waits for the batch. A real batch's draft that still stands when the batch commits is promoted even if a fork ran the effect since: any later real run would have dropped it, and the fork's run belongs to another world while this batch publishes this draft's value. A draft belongs to its batch's whole merged cohort, so what a resumed segment creates joins it after a merge or a rescue folded the batch into another.

A derived whose evaluation for a view stays in that view — a fork's, or a run that read a hidden value — likewise keeps the effects and signal of its committed evaluation. The effects the view's evaluation created belong to that batch. When the batch commits they replace the committed evaluation's effects, because what that batch put on screen came from this evaluation: `$state.eager` read in a template derived keeps its value current only through them (`async-eager-derived`). A discard destroys them, and the batch's next evaluation of the derived or any later committed evaluation replaces them. Batches merged into one install only the newest evaluation any of them made. A derived nobody reads holds no view's effects: losing its last reader drops them, and effects installed while it stays unread freeze at once, as its committed ones do. Under a view, a derived destroys its previous effects after the run instead of before it, because only the run tells whether its result replaces the derived's value.

Without this, a fork that preloads another key stops the committed key's subscription and leaves its own running after a discard. A fork started while a real batch's request is in flight aborts that request, and that batch never commits. Draft children stay linked in the effect tree, so any other batch that reaches one of a batch that has not ended, by traversal or by settling a block that a content effect's write marked, hands it, with whatever is dirty under it, to that batch instead of running it. A fork set aside for touching no root is readmitted to the pending batches. An effect a batch's draft run created exists only in that batch's world, and run elsewhere it would read values that world replaces.
