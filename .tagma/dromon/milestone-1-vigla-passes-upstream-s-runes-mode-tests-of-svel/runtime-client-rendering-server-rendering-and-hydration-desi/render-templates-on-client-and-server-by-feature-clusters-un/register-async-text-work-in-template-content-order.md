---
id: 01a19c9a-622c-7c14-9040-7e50b94141d4
title: Register async text work in template-content order
ord: 7
tags: ["task"]
fields:
  {
    "holder": "tagma:01a18754-3a91-778c-bdc8-cf0239ed279a",
    "status": "done"
  }
edges:
  - kind: discovered-from
    to: 01a19c75-540b-7e65-b61e-2535d72a2a00
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
  - kind: relates
    to: 01a19c75-540b-7e65-b61e-2535d72a2a00
---
Complete async-dont-rebase-new-batch-3 in dom and hydrate. The current first assertion traces to async text registration occurring in client init before the following structural branch, reversing the frozen upstream request order. Keep hydration parking/claiming at navigation time, but correct the coupled async-TEXT compiler/DOM work-registration producer without moving all async setup or changing Core scheduling semantics. Verify the complete scenario and affected async text/hydration controls before recording both entries. This is the remaining compiler dependency of the stale-reader cohort, not evidence that all later assertions already pass.