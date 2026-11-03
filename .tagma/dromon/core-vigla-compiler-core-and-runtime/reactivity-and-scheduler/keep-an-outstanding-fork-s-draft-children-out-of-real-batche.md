---
id: 01a19f13-4762-7c0a-87c6-a250ae7344a5
title: Keep an outstanding fork's draft children out of real batches' reach
ord: 46
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e32-fa75-7284-935b-cb2fd711b818",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a19ed2-030c-7d67-b970-41b1432b9946
---
While a fork is neither committed nor discarded, the children its runs create stay linked in the effect tree, so a real batch that reaches one can run it in the committed world. Speculative work must stay unreachable from committed flushes until its fork commits. Prove it red first through public `vigla`.