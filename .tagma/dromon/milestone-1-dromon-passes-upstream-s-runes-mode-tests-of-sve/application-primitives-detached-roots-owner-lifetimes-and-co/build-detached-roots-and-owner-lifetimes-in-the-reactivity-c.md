---
id: 01a18776-8ea8-7aaf-bf46-b802ff96b5e0
title: Build detached roots and owner lifetimes in the reactivity core, scheduled and settled like components
ord: 1
tags: ["task"]
fields:
  {
    "holder": "tagma:01a18754-3a91-778c-bdc8-cf0239ed279a",
    "status": "done"
  }
edges:
  - kind: implements
    to: 01a18776-8e37-7bdc-93a5-7dae8191e72f
---
The reactivity half of [[8191e72f]]: detached roots with an explicit owner, owners holding and disposing what was created under them, their effects and async work under every scheduler invariant, the server's owner per `render()` call. Decide the API early and give it to `render`, which binds context to owners.