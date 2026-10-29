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
---
An effect's teardown — on rerun, on destroy, a commit-time `onDestroy` included — reads every source the batch being processed wrote as it stood before that batch's first write to it, and a derived over such a source is computed afresh from those values without touching its cache. Upstream pins this: a teardown releasing what its run registered must see what the run saw (`effect-teardown-stale-value`, `effect-teardown-multiple-writes`, `derived-cleanup-old-value`). The values come from the batch's `before` map, which a batch keeps for every source it writes anyway for views and merging, so the rule costs no bookkeeping beyond it. A source the teardown writes itself reads back its new value. Outside a flush the open batch's writes are the ones hidden. A write made during content or effects of a batch goes to the next batch, so its value from before that write is hidden too.
