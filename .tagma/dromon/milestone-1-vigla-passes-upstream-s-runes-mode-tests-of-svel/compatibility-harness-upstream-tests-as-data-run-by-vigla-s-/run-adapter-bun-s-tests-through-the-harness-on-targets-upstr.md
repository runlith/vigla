---
id: 01a187ab-b7ad-7592-8d92-50afb81b8650
title: Run adapter-bun's tests through the harness on targets/upstream
ord: 7
tags: ["task"]
fields:
  {
    "holder": "tagma:01a18754-3a7f-7a8c-b16f-398394e4ee29",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fab49056597
---
Kit 3.1.0 ships `packages/adapter-bun` with its own tests; the operator put the bun adapter in milestone 1 beside node and static. Copy its tests in as the node adapter's were, rule each in the manifest, and reach equality with upstream's own runner on `targets/upstream`.