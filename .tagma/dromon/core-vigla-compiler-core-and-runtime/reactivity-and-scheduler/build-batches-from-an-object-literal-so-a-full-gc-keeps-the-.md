---
id: 01a19f31-2119-77f4-b857-0fb2860214e5
title: Build batches from an object literal so a full GC keeps the scheduler optimized
ord: 50
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e8e-1ebc-75c8-bf20-40d6cc82a51d",
    "status": "done"
  }
---
`Batch` is the one runtime record built as a class: `class Batch extends History` with field initializers. V8 gives such an instance its map through a chain of field-by-field transitions, and it holds transitions only weakly. When no batch is alive at a full GC, which is the state between flushes, the chain is cleared. Every optimized function that checked a batch's map is then deoptimized ("embedded weak objects cleared"): `write`, `record`, `mark`, `dirty`, `enqueue`, `traverse`, `settle` and `run` recompile after each major GC. Each benchmark sample starts with `gc()`, so `writes_1000_effects_1000` runs partly unoptimized: 15.4 ms against upstream's 10.5. With one finished batch kept alive, the same replica runs in 7.35 ms instead of 13.4. Sources, deriveds and effects do not have this problem: they are object literals, whose maps the creating function's feedback keeps alive. Batches should be built the same way. `History`'s lazily materialized `before` then becomes a function, since a getter in a literal would cost a closure per batch.