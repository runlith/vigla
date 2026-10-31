---
id: 01a19444-6b1c-7616-a15d-151882a03c9d
title: Node deployment adapter
ord: 13
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "src/index.ts"
      }
    ],
    "id": "adapter-node",
    "kind": "product"
  }
edges:
  - kind: imports
    to: 01a193f1-4d97-7589-b3a8-69aa6c365dd0
  - kind: imports
    to: 01a193f1-4da0-78c5-8389-3b987555f955
sources:
  - kind: dir
    ref: packages/adapter-node
---
A deployable Node server for Kit applications, with a reusable HTTP handler for hosts that already own a listener. It owns output assembly, deployment environment, static delivery and process shutdown; application routing and rendering remain the built server's.