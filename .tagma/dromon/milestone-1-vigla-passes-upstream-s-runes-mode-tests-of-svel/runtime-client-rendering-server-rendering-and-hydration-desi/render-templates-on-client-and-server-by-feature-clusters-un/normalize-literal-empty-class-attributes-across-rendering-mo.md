---
id: 01a19cf7-f95f-7896-90f2-198a3beb6f83
title: Normalize literal empty class attributes across rendering modes
ord: 8
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a193f2-ff55-75b7-98e3-3cbacd2aed6d
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
---
Complete empty-class-attribute-template in dom, hydrate, ssr and async-ssr. Fresh remainder evidence retains class="" where the frozen public contract omits it. Read the upstream behavior and current client/server lowering before fixing the producer; preserve dynamic/nullish class and namespace semantics. Prove all four cases and affected recorded class controls, then land the source and four manually added passing ids.