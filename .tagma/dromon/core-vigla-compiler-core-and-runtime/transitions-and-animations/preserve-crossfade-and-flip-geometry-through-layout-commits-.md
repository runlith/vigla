---
id: 01a19c72-d20a-72d2-b76c-a804a5a46d7d
title: Preserve crossfade and FLIP geometry through layout commits and interruption
ord: 2
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e32-fb25-7109-9e5d-e26d8c51fa54",
    "status": "in_work"
  }
edges:
  - kind: relates
    to: 01a19574-64a8-7ee5-8a9b-8d5d4fab4d64
---
The layout pass, placement leases and crossfade transfer landed in 117f5b548d; `issue-10252-paired-layout` (4 of 8 motions) and `issue-10252-placement` (flex source displaced 23px) are committed unrecorded and red. Complete the remaining #10252 producer, including interrupted motion and perspective. Reconcile the parked DOM capture/mover consumers with the accepted Change ABI. An early layout barrier may stabilize and measure only participants already known without entering opaque sibling callbacks. User-deferred callbacks keep run-to-return order and a full synchronous AnimationConfig under spread/delegation, with a distance callback called once and its numeric duration immediately readable; opaque-late calls retain ordinary live/fallback semantics. Reentrancy, function/heuristic markers, duplicate callbacks and an unapproved opt-in API are not substitutes. Preserve independent IN/OUT restart behavior, bidirectional progress, historical outgoing views and authored style restoration. Only matched crossfade senders release flow; nodes remain through their ordinary outros. Prove the actual runtime candidate red to green with both endpoints and final layout, affected recorded controls, unmatched fallback, absolute/fixed/grid/flex and re-entry, within the coordinated focused run budget. A bounded layout candidate does not finish the perspective or interruption obligations.