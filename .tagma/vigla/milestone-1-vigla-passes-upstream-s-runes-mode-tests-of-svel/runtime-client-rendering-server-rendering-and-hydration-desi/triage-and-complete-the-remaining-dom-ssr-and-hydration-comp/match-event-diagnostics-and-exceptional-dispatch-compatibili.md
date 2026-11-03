---
id: 01a19c1e-cff7-7ddd-8db1-7e258e6d0f7e
title: Match event diagnostics and exceptional dispatch compatibility
ord: 5
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19c1d-fc8a-7b61-a6b5-36769935f496",
    "status": "done"
  }
---
Event expressions with impure calls or local binding dependencies now cache their handler under a derived; unbound global calls remain live. Development invocation reports invalid values and failed thunk reads at the source expression without masking errors. Seven assigned compatibility rows and the production global-handler regression were added manually; the global regression was red on Vigla and green on frozen upstream before its correction. Nine assigned variants, the new regression, thirteen existing event variants, and core/adapter tsrs checks pass. One independent review found the global-call cache regression, which was fixed. Shared attribute-value lowering moved unchanged from element.ts to values.ts after formatting exposed the file-size gate; evidence is retained in this thread's scratch.