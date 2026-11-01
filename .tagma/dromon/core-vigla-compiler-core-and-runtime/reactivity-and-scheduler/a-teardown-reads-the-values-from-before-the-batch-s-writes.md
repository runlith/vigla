---
id: 01a18769-e4ee-7426-8e95-a833a8171ace
title: A teardown reads the values from before the batch's writes
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/tracking.ts
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/batch.ts
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/history.ts
---
An effect's teardown — on rerun, on destroy, a commit-time `onDestroy` included — reads every source the batch being processed wrote as it stood before that batch's first write to it, and a derived over such a source is computed afresh from those values without touching its cache. Upstream pins this: a teardown releasing what its run registered must see what the run saw (`effect-teardown-stale-value`, `effect-teardown-multiple-writes`, `derived-cleanup-old-value`). The previous value must be captured at the write, since the write overwrites it, so a batch's first write to a source appends the source and its old value to the batch's log and stamps the source with the batch's order and the entry's position — no hashing on the write path. A teardown finds a value through that stamp. The `before` map views, merging and rebase iterate is built from the log only when one of them asks, or when another live batch restamped a source this batch logged first, which marks this batch so its lookups go through the map. A source the teardown writes itself reads back its new value. Outside a flush the open batch's writes are the ones hidden. A write made during content or effects of a batch goes to the next batch, so its value from before that write is hidden too — from the teardowns of the batch being processed only. The batch that receives it does not hide it from its own teardowns, as upstream clears its old values before processing the next batch: a component torn down by a later batch reads what its `onMount` wrote (`onmount-prop-access`). That mark follows the source's entry when batches merge.
