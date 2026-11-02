---
id: 01a19cc6-5b7a-7f8b-a485-4e6108135e98
title: Restore recorded async fork, overlap and branch cases
ord: 22
tags: ["task"]
fields:
  {
    "holder": "tagma:01a18754-3a91-778c-bdc8-cf0239ed279a",
    "status": "done"
  }
edges:
  - kind: discovered-from
    to: 01a19c75-540b-7e65-b61e-2535d72a2a00
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fac9d5e3831
---
Restore the 19 recorded async fork, overlap and branch variants from post-equality-2026-11-02 while preserving all passing ids, the new 13-case equality cohort and outgoing-view contracts. The original run included live transition protocol work, so attribute producing causes through controlled reproduction without resetting peer lines. Verify the complete recorded runtime population after the final coherent source lands; that full run requires separate permission.

Source correction landed in 5da7addee2: fresh rebased async runs include their observed committed frontier, equality validation retains concealed-writer revisits even without executing user code, and a foreign fork's structural run does not validate an unowned batch. The unchanged peer transition candidate was excluded. Evidence in scheduler scratch: recorded-19-current/svelte.json reproduces 19/19 red; run-order restores 14; hidden-validation restores 19/19. Equality-preserved is 13/13 green and lifetime-controls is 15/15 green; 15 async/outgoing module controls and core tsrs pass. One new public Core regression was red 4 != 5 then green. One independent review found no actionable defects. The one authorized full recorded-runtime run passed: 2,868 assertions, no failures or pending cases, and all 2,865 recorded ids green (runtime-runes 2,627; hydration 85; signals 27; own/runtime 126). Full evidence and witness-before/after.json are in /Users/teunlao/.tagma-dev/scratch/01a18754-3a91-778c-bdc8-cf0239ed279a/recorded-runtime-after-5da7addee2/. HEAD moved from 9eb5e4b396b6b75f37511a17d4437b23c8f2ac21 to 361ebb6c3f2f4876877f48c776ec06a8fc668e27 while the measured source digest stayed 30b4a706a486fb2d3b24f7fb7f8b09fce7c6d56a2797d42bc6afe602453d78de and the transition candidate hashes stayed unchanged. This proves the witnessed shared tree including that uncommitted candidate, not a committed-only tree. SSR was not repeated.
