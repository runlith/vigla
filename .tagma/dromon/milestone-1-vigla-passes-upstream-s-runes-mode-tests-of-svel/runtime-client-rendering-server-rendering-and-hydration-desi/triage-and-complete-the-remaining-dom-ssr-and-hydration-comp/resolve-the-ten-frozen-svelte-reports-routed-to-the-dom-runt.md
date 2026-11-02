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

The input contract preserves native ancestor-listener order and stopPropagation, binding updates even when propagation stops, and microtask effects. The browser checkpoint difference in #16168 is excluded under those guarantees. Crossfade promises two transforming fades; #6668's full-opacity composite expectation is excluded, preserving the default. Blocks owns forms and its landed #17395 producer; this task integrates that proof. The remaining listener, prop and transition producers stay in this unit. For #15627, deriveds owned by the departing subtree evaluate in its last-selected view. Their transitive reads, including outer and root-owned deriveds, use the same view and its local cache. Direct source, prop and outer-derived reads outside that computation stay current. Source-local history avoids per-view write fanout; its retained values are bounded by the oldest outgoing view and pruned as views end. This replaces the whole-thunk proposal stopped by recorded `transition-evaluation (dom/hydrate)`. Old duration in the child's owned derived is intentional. Audit all readers while the branch leaves, including outro parameters and callbacks, and keep recorded transition entries green. Scheduler owns the primitive and DOM transitions its use, with their held-batch contract agreed before landing. A modern Safari pass does not settle the unavailable affected iOS 15/Safari 15/17 engines for #6914/#4712.

For #10252, preserve user-deferred callbacks' run-to-return order and their full synchronous AnimationConfig, including timing/easing fields and callable css/tick preserved under spread or delegation. A distance-based duration callback runs once and its numeric result is available to the wrapper. A strict typed transitions/DOM layout barrier may capture displayed poses, stabilize matched senders, measure final targets and start animations only where the needed participants are already known without entering opaque sibling callbacks. Preserve displayed sender geometry and share stabilization with FLIP. Reentrant sibling evaluation, function/heuristic markers, repeated user callbacks and a new opt-in API are not accepted substitutes for compatibility. Retain nodes through outro completion, preserve unmatched/fallback and ordinary transition behavior, and restore authored styles on cancellation or re-entry. The new default lands only with a public runtime red-to-green proof and green affected recorded transition/crossfade, fallback, absolute/fixed/grid/flex and cancellation/re-entry controls; a concrete contract conflict returns to the lead before that default changes. The retained authored sender-space intervention establishes causality only. Perspective and interrupted animation behavior remain within this task's unfinished scope.
