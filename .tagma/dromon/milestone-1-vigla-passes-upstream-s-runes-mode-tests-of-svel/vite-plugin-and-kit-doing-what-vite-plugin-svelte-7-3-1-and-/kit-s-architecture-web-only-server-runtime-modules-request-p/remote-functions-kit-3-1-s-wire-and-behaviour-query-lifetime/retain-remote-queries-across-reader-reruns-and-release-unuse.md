---
id: 01a19598-1509-77ef-aa0b-407a7adf7ac8
title: Retain remote queries across reader reruns and release unused arguments
ord: 4
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1945b-1c58-71fb-adba-35b832991389",
    "status": "in_work"
  }
---
Retain reactive query readers through the core's createSubscriber so a rerun reuses the same key and changed arguments release keys no run reads. Preserve plain owned reads for their owner's run and ownerless one-shot reads. Prove both reader lifetimes through the client contract, verify refreshAll and remaining remote entries in approved groups of at most twenty, and manually record first-attempt passes with the fix.