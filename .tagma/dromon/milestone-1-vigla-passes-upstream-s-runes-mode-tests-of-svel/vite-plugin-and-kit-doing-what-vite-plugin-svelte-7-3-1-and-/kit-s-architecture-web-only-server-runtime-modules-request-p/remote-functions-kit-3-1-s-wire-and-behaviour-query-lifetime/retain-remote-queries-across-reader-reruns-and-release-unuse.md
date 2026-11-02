---
id: 01a19598-1509-77ef-aa0b-407a7adf7ac8
title: Retain remote queries across reader reruns and release unused arguments
ord: 4
tags: ["task"]
fields:
  {
    "status": "open"
  }
---
Retain a query across a reader rerun using a microtask-deferred per-run release, and release keys no run reads after an argument change. Prove both lifetimes through the client contract, verify refreshAll and remaining remote entries in approved groups of at most twenty, and record first-attempt passes with the fix.