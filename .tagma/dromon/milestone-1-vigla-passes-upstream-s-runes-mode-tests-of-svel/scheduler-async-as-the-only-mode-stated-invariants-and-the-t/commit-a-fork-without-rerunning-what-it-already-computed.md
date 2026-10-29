---
id: 01a187b8-c48a-789f-9abb-a30452a01275
title: Commit a fork without rerunning what it already computed
ord: 4
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a18752-ff03-7988-bdb3-d50e5e2ef4a9
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fac9d5e3831
---
`fork.commit()` applies the fork's writes as real writes, which re-marks every reaction downstream of them: blocks, deriveds and async expressions the fork already ran under its own view run again at commit, and an async expression starts a second request. Upstream 5.57.3 reuses the fork's work: `async-fork-no-rerun` expects a derived the fork evaluated not to recompute at commit, and the own sample `fork-dirt-consumed` has to release its gate a second time after commit on Vigla only. Commit must carry over what the fork computed: deriveds' view values whose inputs are unchanged, and blocks and async runs whose last run was under the fork's view, dirtying only reactions the fork did not run.