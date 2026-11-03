---
id: 01a19e32-1cfa-773c-84ce-4a32a485fac7
title: Prove server request scopes, external services and isolated applications on the public core
ord: 18
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e32-fa75-7284-935b-cb2fd711b818",
    "status": "done"
  }
edges:
  - kind: implements
    to: 01a19de0-59b2-7950-bf1d-a0b137f29ce1
---
Scenarios 5–7 of [[37f29ce1]]: a request owner carrying services and context into `render()` and ending every render owner, signal and teardown beneath it on dispose; `external` and `createSubscriber` living under service owners and releasing on dispose; several independent applications in one realm with isolated contexts and lifetimes. Write each as a public-contract test importing public `vigla` only, on the client entry and the server variants, red first where the core fails, and fix the core at its producer. Also owns the unrecorded `async-ondestroy-ordering (async-ssr)` entry, whose server teardown order (`root,B,B*` instead of `C,A,B,B*,root`) lives in the same server owner/context code.