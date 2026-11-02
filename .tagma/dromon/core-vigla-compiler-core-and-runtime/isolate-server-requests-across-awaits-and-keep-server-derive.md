---
id: 01a19e65-500e-7822-bece-d796410d878d
title: Isolate server requests across awaits and keep server derived values current
ord: 21
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a19de0-59b2-7950-bf1d-a0b137f29ce1
---
From the core architecture review, scenario 10 of [[37f29ce1]]: compiled server code restores a render's owner after `await` and clears it only at a later microtask, so another request's continuation queued in that window sees it, and Kit's request lookup consults the ambient owner first (D2). End each restored server segment explicitly as the client's `unsave` does; give the core an async-context port (AsyncLocalStorage now, AsyncContext later) carrying the owner across `await`, and move Kit's request scope onto it (O2). The public server `derived` caches its first value for the owner's whole life although its cells change (D7): version server cells and validate reads, or cache only within a render. Prove a concurrent-request leak red first.