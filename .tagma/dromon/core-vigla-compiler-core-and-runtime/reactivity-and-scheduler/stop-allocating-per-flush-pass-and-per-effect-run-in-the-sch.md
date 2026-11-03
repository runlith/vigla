---
id: 01a19f02-d1ff-7dc7-b530-be55d12d14e4
title: Stop allocating per flush pass and per effect run in the scheduler
ord: 45
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e8e-1ebc-75c8-bf20-40d6cc82a51d",
    "status": "in_work"
  }
---
Each flush allocates where nothing needs holding: `resolve` builds a set, spreads it into an array and sorts it even for one root, `commit` splices the empty change list, `settle` creates a set for every effect it runs, and closing a batch's history allocates a fresh log and scans the live histories. Benchmarks made of many small flushes — `kairo_avoidable`, `write_flush_one_reader`, `clean_effects`, `writes_1000_effects_1000` — trail upstream by 1.07–1.5×, and their profiles show `resolve`, `recycle` and `clear` at 3–4% each.