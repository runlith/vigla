---
id: 01a19cc6-5b7a-7f8b-a485-4e6108135e98
title: Restore recorded async fork, overlap and branch cases
ord: 22
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a19c75-540b-7e65-b61e-2535d72a2a00
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fac9d5e3831
---
The recorded runtime check post-equality-2026-11-02 failed 19 existing variants in async-commit-effect-overlap, async-fork-branch-async-adopted, async-fork-commit-superseded-effect, async-linear-order-same-derived, async-overlap-multiple-5/6, async-state-new-branch-2/3 and async-state-new-branch-fork-2/3. Its starting HEAD was b39273b3a375010d60f6ff5a156907dc4f238ae7 with live #10252 protocol changes, so isolate the producing causes without resetting peer lines. Restore the recorded cases while preserving the new 13-case equality cohort and outgoing-view guarantees. Retain all passing ids and assertions; verify targeted reds before fixes and the complete recorded runtime set after the final coherent source lands.