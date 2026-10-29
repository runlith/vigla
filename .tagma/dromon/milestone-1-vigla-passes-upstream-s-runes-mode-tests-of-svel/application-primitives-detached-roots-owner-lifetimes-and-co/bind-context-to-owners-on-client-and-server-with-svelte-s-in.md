---
id: 01a18776-8ec9-7c19-8ef7-f27ebfb6a8b0
title: Bind context to owners on client and server, with svelte's init-only context as its projection
ord: 2
tags: ["task"]
fields:
  {
    "holder": "tagma:01a184d8-1b37-7bfc-8899-05d6b3ce2282",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a18776-8e37-7bdc-93a5-7dae8191e72f
---
The rendering half of [[8191e72f]]: context set and read through an owner at any time and inherited down the owner tree, on client and server; `svelte`'s `getContext` and `setContext` keep upstream's init-only behaviour and errors as a projection over it. Builds on the owner API `scheduler` gives.