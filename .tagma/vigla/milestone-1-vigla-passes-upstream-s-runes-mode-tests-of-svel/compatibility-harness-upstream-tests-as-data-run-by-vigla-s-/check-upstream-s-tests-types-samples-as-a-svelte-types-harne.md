---
id: 01a1a130-2780-77e3-8fb3-292a3b18b57d
title: Check upstream's `tests/types` samples as a `svelte/types` harness suite with tsrs
ord: 9
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1a108-8556-7ceb-800a-4407eb68dbce",
    "status": "done"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fab49056597
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
---
Spec 658ccea4 counts Svelte's `tests/types` in scope, checked with tsrs, but the harness has no suite for them, so those samples have no manifest status. Add a `svelte/types` suite that checks each sample against the target's published declarations, one entry per file, give every sample a status (class components, `svelte/legacy` and `createEventDispatcher` as subject dropped or converted out), add upstream's own `tsc` check to the reference comparison, and record Vigla's passing entries.