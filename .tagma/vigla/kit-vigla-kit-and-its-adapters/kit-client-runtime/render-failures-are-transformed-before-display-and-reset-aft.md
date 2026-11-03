---
id: 01a1959c-a8c1-7110-98b9-cf980085eb96
title: Render failures are transformed before display and reset after replacement props settle
ord: 12
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/client/client.ts
  - kind: file
    ref: packages/kit/src/client/view.ts
---
A boundary's failed snippet receives the core root's transformed error value; updating page state later would leave the error component with the raw exception. Resetting a failed boundary before replacement props flush can resurrect its stale subtree. A new commit therefore retains only the resets from the view it replaces and runs them after that commit settles, without resetting failures raised by the new view.