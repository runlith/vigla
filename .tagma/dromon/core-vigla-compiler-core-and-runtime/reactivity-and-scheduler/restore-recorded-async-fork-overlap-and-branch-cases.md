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
Restore the 19 recorded async fork, overlap and branch variants from post-equality-2026-11-02 while preserving all passing ids, the new 13-case equality cohort and outgoing-view contracts. The original run included live transition protocol work, so attribute producing causes through controlled reproduction without resetting peer lines. Verify the complete recorded runtime population after the final coherent source lands; that full run requires separate permission.

Source correction landed in 5da7addee2: fresh rebased async runs include their observed committed frontier, equality validation retains concealed-writer revisits even without executing user code, and a foreign fork's structural run does not validate an unowned batch. The unchanged peer transition candidate was excluded. Evidence in scheduler scratch: recorded-19-current/svelte.json reproduces 19/19 red; run-order restores 14; hidden-validation restores 19/19. Equality-preserved is 13/13 green and lifetime-controls is 15/15 green; 15 async/outgoing module controls and core tsrs pass. One new public Core regression was red 4 != 5 then green. One independent review found no actionable defects. The complete recorded runtime check remains outstanding and this task stays in work until its result.
