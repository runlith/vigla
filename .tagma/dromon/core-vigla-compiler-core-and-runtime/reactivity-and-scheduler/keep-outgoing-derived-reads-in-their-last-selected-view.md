---
id: 01a19c2f-046e-75e3-b3d6-ba537937f3c4
title: Keep outgoing derived reads in their last-selected view
ord: 19
tags: ["task"]
fields:
  {
    "holder": "tagma:01a18754-3a91-778c-bdc8-cf0239ed279a",
    "status": "in_work"
  }
edges:
  - kind: relates
    to: 01a19574-64a8-7ee5-8a9b-8d5d4fab4d64
---
Implement the scheduler primitive for #15627: departing-owned deriveds and their transitive reads use one immutable last-selected source view with local caches, held/merged/fork seeding and lifetime cleanup. Preserve direct current reads, speculative batch admission, local derived state and teardown semantics; deliver with the DOM transition integration and public controls.