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
Serialize user-controlled page-node metadata safely in the HTML boot payload while preserving decoded metadata and the non-HTML data wire. Prove the boundary through public Server.respond and then the tracked-query browser scenario; its existing timeout did not reach the protection assertion. Unverified edits remain in server/data.ts and server/server.test.ts. Execution is blocked by the provider's non-retryable cyber_policy failure; preserve that WIP and await the operator-authorized continuation rather than changing model, thread or rung independently.