---
id: 01a19cb4-7737-744d-8996-7a50adbf9921
title: Make page-node metadata safe for inline HTML
ord: 18
tags: ["task"]
fields:
  {
    "holder": "tagma:01a184d8-1b37-7bfc-8899-05d6b3ce2282",
    "status": "done"
  }
edges:
  - kind: discovered-from
    to: 01a193e1-7874-7e93-a8a0-d5f7479de14c
  - kind: implements
    to: 01a193ed-396f-73b6-bbe3-bad77aa7b0be
sources:
  - kind: file
    ref: packages/kit/src/server/data.ts
---
Serialize the complete HTML page-node envelope and embedded transport decoder names safely while preserving decoded metadata and the non-HTML data wire. Implementation landed in f7b9cb2c7f with public Server.respond red-to-green checks for tracked query keys and codec names; all 52 affected server/remote cases and Kit typechecking passed. The browser protection is established by basics' `XSS > no xss via tracked search parameters`, recorded in all twelve variants — dev and build, with and without JavaScript, server route resolution and cross-platform — and passing on 2026-11-04 at 4d3de82a. The implementation ran after an external Terra model change; attribution and recognition of that scoped model exception await the operator.