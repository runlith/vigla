---
id: 01a19cf3-620f-7990-8c34-08fa3dc2cceb
title: Track service-owned cells read after Owner.run returns
ord: 23
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a193e1-7874-7e93-a8a0-d5f7479de14c
  - kind: implements
    to: 01a18776-8e37-7bdc-93a5-7dae8191e72f
---
A derived creates a cell through service.run(() => cell(0)), then reads state.current after that run returns. Updating the service-owned cell produces direct:1, derived:0, shown:0 instead of shown:1. The retained reproduction uses public root/cell/effect/tick and the declared derived/get compiler port: kit-remote-client scratch owned-cell-derived.mjs. Verify the creation/owner/locality path and fix its producer without breaking genuine derived-local state or outgoing-view isolation. Prove the general Core contract and check the affected form first-issues consumption; no Kit refresh/proxy workaround.