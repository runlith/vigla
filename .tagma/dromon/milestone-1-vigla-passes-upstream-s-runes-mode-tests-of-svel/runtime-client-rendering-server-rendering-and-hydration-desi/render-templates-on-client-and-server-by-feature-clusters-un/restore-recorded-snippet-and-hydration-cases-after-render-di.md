---
id: 01a19c81-5c79-729a-b7bc-608197ecddff
title: Restore recorded snippet and hydration cases after render diagnostics
ord: 6
tags: ["task"]
fields:
  {
    "holder": "tagma:01a187a1-6608-7ee2-9f47-f0c567ddde77",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a18752-ff03-7988-bdb3-d51034d8c1ab
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
---
Restore seven recorded snippet/hydration entries without weakening DEV diagnostics. The scoped working-tree reproduction failed all seven: optional render lowering emitted `callee ?? noop()`, passing undefined instead of the empty callable. Correct the client producer to retain the runtime helper reference. The seven regressions and six diagnostic controls now pass in the 15-entry scoped report `snippet-regressions-after/svelte.json` under the templates scratch; both package tsrs checks pass. No passing ids or expectations change.