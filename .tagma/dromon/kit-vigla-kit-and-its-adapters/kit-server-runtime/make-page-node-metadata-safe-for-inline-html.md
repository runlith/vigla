---
id: 01a19cb4-7737-744d-8996-7a50adbf9921
title: Make page-node metadata safe for inline HTML
ord: 18
tags: ["task"]
fields:
  {
    "holder": "tagma:01a193e2-1f81-73bf-bca7-d1170e1158da",
    "status": "in_work"
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
Serialize the complete HTML page-node envelope and embedded transport decoder names safely while preserving decoded metadata and the non-HTML data wire. Implementation landed in f7b9cb2c7f with public Server.respond red-to-green checks for tracked query keys and codec names; all 52 affected server/remote cases and Kit typechecking passed. The remaining check is the frozen tracked-query browser scenario on a freshly prepared and authorized production artifact: its earlier timeout did not reach the protection assertion. No browser protection pass is established yet. The implementation ran after an external Terra model change; attribution and recognition of that scoped model exception await the operator, so no further team-initiated work is assigned to that worker.