---
id: 01a19ea4-93d1-7012-b8ba-fb652f376240
title: Each dependency edge records its position at both ends, so removing a reader costs O(1)
ord: 2
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a19e65-500e-7822-bece-d7980419984b
sources:
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/edges.ts
---
A source lists its readers in `reactions` and a reaction its dependencies in `deps`. Each edge also records where it sits at the other end:
- `links[j]` on a source is that source's index in `reactions[j].deps`;
- `slots[i]` on a reaction is that reaction's index in `deps[i].reactions`.

Removing an edge moves the source's last reader into the freed position, and the moved link repairs that reader's slot. Destroying K readers of one source therefore costs O(K). Searching each reader out of `reactions` made it O(K²), which unmounting a long list reading one shared value hits.

The pairs only hold if they change together. Every edge change goes through this file, and a reaction listed in a source's `reactions` always has its `slots`. A direct write to `deps` or `reactions` corrupts the repair for the other readers of that source.

An operation finishes moving edges before any code it triggers runs. A derived that loses its last reader holds resources of its evaluation's effects, and freezing them runs teardowns. Those teardowns can destroy reactions whose edges the operation is still moving. So a derived is frozen only after the operation's edges are consistent again, and only if it still has no reader by then.

Reconciling a run that read some old dependencies again in a new order keeps each such edge where it stands in the source's `reactions`. Only the edge's index in `deps` changes. The old slot reaches the new position through the source's `read` mark, which carries it only between those two steps. No user code and no write can run there, so readers of the mark never see it ([[7d2855c5]]).

The mark walk and staleness checks never read `slots` or `links`, so both fields stay behind the fields every visit reads ([[2a93bdf4]]).
