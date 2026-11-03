---
id: 01a19f4b-ca38-7994-ba82-53c242b00569
title: Trim the per-evaluation and per-read work that keeps kairo_deep, kairo_broad and effect_reads_1000 behind upstream
ord: 52
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e8e-1ebc-75c8-bf20-40d6cc82a51d",
    "status": "in_work"
  }
---
On HEAD 3a75edc0, after 8c6aa02f35, cbe70359ca and c4da25733d, three benchmarks still trail upstream: `kairo_deep` 1.12–1.15, `kairo_broad` 1.09–1.10 and `own/effect_reads_1000` 1.11. Profiles show no single producer.

**Derived evaluation.** With inlining off, `kairo_deep` spends most of its time across these, about 1–4% each, apart from `refresh` and `stale`:
- `refresh` 14% of self time: its view, leaving and failure branches, and two nested `try` blocks;
- `stale` 11%: the `stale` → `refresh` recursion down the chain;
- `track` and its frame bookkeeping: `opened` writes twelve fields and `finished` nulls five again;
- `setOwner` saved and restored per evaluation;
- `settleRun` with `reconcile`, `retain`, `now` and the status store.

With inlining on, 17% of `kairo_broad` lands on `settleRun`'s closing position and is not yet attributed. Making the `captured` store conditional did not move it.

**Reads.** Every read runs four functions, each with a view, leaving or teardown check of its own:
- `get`;
- `read`: checks `past`, `selecting`/`leavingCount`, `view`, `isDerived`;
- `depend`;
- `capture`: checks `view`, `late` and `awaited`.

Work on this is measured against a HEAD copy with the redirect harness in the core-perf thread's scratch. A change counts only if it moves these benchmarks beyond the 2–3% run-to-run noise.