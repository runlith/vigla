---
id: 01a19c1e-cff7-7ddd-8db1-7e258e6d0f7e
title: Match event diagnostics and exceptional dispatch compatibility
ord: 5
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19c1d-fc8a-7b61-a6b5-36769935f496",
    "status": "in_work"
  }
---
Event expressions containing calls now cache their handler under a derived; development invocation reports invalid values and failed thunk reads at the source expression, preserving original errors and silent plain nullish handlers. All nine assigned sample variants passed, including seven manually added rows, and thirteen existing event variants passed in the scoped regression run; core and adapter tsrs checks passed. Evidence is retained in the event-diagnostics thread scratch under event-baseline, event-fixed, propagation-isolated and event-regressions. The earlier grouped propagation failure was contamination from invalid-values leaving its test error listener installed after its assertion failed; isolated propagation already passed.