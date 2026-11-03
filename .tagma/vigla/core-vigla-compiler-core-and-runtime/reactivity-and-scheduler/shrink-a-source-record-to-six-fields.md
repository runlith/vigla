---
id: 01a19f02-d1ff-7dc7-b530-be54934cfb81
title: Shrink a source record to six fields
ord: 44
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e8e-1ebc-75c8-bf20-40d6cc82a51d",
    "status": "closed"
  }
---
A source carries eight fields where upstream's carries six: `logged` and `slot` locate its prior value in the newest history that recorded it, and `links` keeps O(1) removal from its readers. `sbench_create_signals` allocates 100,000 sources per sample and spends most of its time in allocation and GC, so the two extra fields cost 1.19× there. The history position can verify itself against the log it points into, and each reader's link can sit beside the reader in `reactions`, keeping O(1) removal and dropping the `links` array per subscribed source.

**Result: not landed.** I built it: `slot` was dropped (the history checks `log[logged - 1] === source`), and readers were stored as `[reaction, link]` pairs read through `eachReader`. Tests and tsrs passed. With it, Vigla's young-generation collections in `sbench_create_signals` match upstream's one for one, and its time outside GC is at upstream's level. It still did not help the target benchmarks:
- Best of 10, against the tree without it: `sbench_create_signals` 33.8 → 36.7 ms, `sbench_create_4to1` 13.3 → 15.5 ms.
- Whole entry, all samples: 3–5% slower.
- Elsewhere the gains were small: `kairo_mux` −1.4%, `sbench_create_1to8` −5%.

These benchmarks keep the best of 10 samples and are dominated by where collections fall relative to the live cells of each iteration. That moves with any change in allocation size: `sbench_create_1to2` swung 0.41 → 1.06 between two runs with no relevant change. The 8-field record is not what makes `sbench_create_signals` trail upstream. The implementation is kept in the core-perf thread's scratch (`record-b/`).