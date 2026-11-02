---
id: 01a19ddb-ef53-7c38-ae19-c47ae227a46f
title: Restore three recorded runtime entries regressed by the async/fork landing
ord: 26
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a19d1b-331b-7188-9525-72f5dbd1bc1e
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fac9d5e3831
---
The full recorded-runtime run after a7d4368c91 (execution 7ec00e32, stable 8468-input witness) failed three recorded entries on first attempt: own `async-branch-removal (dom)`, own `hydration-mismatch-lifetime (dom)` and `hydration/safari-borking-2 (hydrate)`. Static producer chains point at a7d4368c91: the earlier-cohort view inheritance in `held.ts:viewOf` leaving a clean structural ancestor unvisited by traversal, and the implicit mounted boundary in `mount.ts` whose anchor settlement skips leftover server nodes before hydration's end-of-root check. Fix each at its Core/DOM producer without weakening samples, earlier-cohort semantics or explicit boundary handling; prove red→green on the three plus bounded async/hydration/owner controls.