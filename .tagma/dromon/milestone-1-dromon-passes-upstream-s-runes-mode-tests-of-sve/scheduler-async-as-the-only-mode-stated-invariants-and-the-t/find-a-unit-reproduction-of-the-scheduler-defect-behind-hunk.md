---
id: 01a185cc-5af2-768a-aac7-ba31c8cabb25
title: Find a unit reproduction of the scheduler defect behind hunk 2 of runlith's Svelte patch
ord: 1
tags: ["task"]
fields:
  {
    "status": "open"
  }
---
Hunk 2 (`Batch.schedule` exiting early on a cleared `CLEAN` bit) is proven only by an fpm e2e; tagma's `patches/README.md` names the mechanism — `#process` moving roots scheduled during its traversal into the next batch and processing a committed batch once more — but not who triggers it. A plain-component test red on Svelte 5.57.3 with async on lets the hunk join the scheduler traps.