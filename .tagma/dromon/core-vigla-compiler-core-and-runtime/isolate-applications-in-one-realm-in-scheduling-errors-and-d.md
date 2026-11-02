---
id: 01a19e65-500e-7822-bece-d797864c006f
title: Isolate applications in one realm in scheduling, errors and diagnostics
ord: 22
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a19de0-59b2-7950-bf1d-a0b137f29ce1
  - kind: waits-on
    to: 01a19e65-500e-7822-bece-d795b5ca984d
---
From the core architecture review, scenario 7 of [[37f29ce1]]: one application's `flushSync()` rethrows another's unhandled effect error, `settled()` waits for every application's work, `fork()` refuses while any application has a pending write (D5), and one global diagnostic reporter reprints a native app's diagnostics in Svelte's form (O5). Give each top-level root a default error sink instead of throwing into an arbitrary flusher, make settlement and fork admission owner-scoped, and key the reporter by the tree's front end. Starts after the owner-lifetime task lands, since both touch batch and settlement.