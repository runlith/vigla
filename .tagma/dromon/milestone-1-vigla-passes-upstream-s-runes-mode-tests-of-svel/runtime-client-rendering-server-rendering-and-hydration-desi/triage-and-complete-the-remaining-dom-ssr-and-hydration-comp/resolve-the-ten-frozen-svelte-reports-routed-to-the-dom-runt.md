---
id: 01a19574-64a8-7ee5-8a9b-8d5d4fab4d64
title: Resolve the ten frozen Svelte reports routed to the DOM runtime
ord: 3
tags: ["task"]
fields:
  {
    "holder": "tagma:01a193e1-e009-75fe-ac94-1ff32a3298c8",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a19454-63c8-70c2-96a1-509e5ed381c8
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
---
Complete the ten DOM reports routed by [[5ed381c8]]: the option and component prop spreads (#17395/#16139), retained static-listener payloads (#17379), native input scheduling (#16168), crossfade/FLIP and lazy-outro cases (#10252/#6668/#4389/#15627), and the affected supported Safari checks (#6914/#4712). Fix each selected producer with a public regression red on Svelte 5.57.3 and green on the fork, or exclude it in [[2e546434]] with retained evidence.

The input contract preserves native ancestor-listener order and stopPropagation, binding updates even when propagation stops, and microtask effects. The browser checkpoint difference in #16168 is excluded under those guarantees. Crossfade promises two transforming fades; #6668's full-opacity composite expectation is excluded, preserving the default. Blocks owns forms and its landed #17395 producer; this task integrates that proof. The remaining listener, prop and transition producers stay in this unit. For #15627, the whole-thunk prior-view proposal is stopped by recorded `transition-evaluation (dom/hydrate)`, which requires a current root prop inside the outro parameter thunk. Await the lead's refined ownership boundary before a prior-view primitive or its transition integration lands. Old duration inside a departing child's owned derived was approved as an intentional difference; live-owner callbacks stay current. Scheduler owns the primitive and DOM transitions its use, with their held-batch contract agreed before landing. A modern Safari pass does not settle the unavailable affected iOS 15/Safari 15/17 engines for #6914/#4712.
