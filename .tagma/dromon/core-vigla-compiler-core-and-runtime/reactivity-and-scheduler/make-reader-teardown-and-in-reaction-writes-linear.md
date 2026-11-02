---
id: 01a19e65-500e-7822-bece-d7980419984b
title: Make reader teardown and in-reaction writes linear
ord: 28
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: waits-on
    to: 01a19e65-500e-7822-bece-d795b5ca984d
---
From the core architecture review: `unsubscribe` removes a reader with `indexOf`, so destroying K readers of one source costs O(K²) — unmounting 10k rows reading one value is about 5·10⁷ comparisons (P1); `readDuringRun` scans each live frame's dependency list on every write inside a reaction (P2); context `get` walks the layer chain twice (P3). Give edges O(1) removal (slot indices or linked edge nodes), reject `readDuringRun` in O(1) when the source was not read since the outermost live frame began, and look up context once. Measure each on a benchmark before and after; hot-path layout notes 2a93bdf4 and 0eca7d2b bind the record shapes. Starts after the owner-lifetime task lands.