---
id: 01a19ea4-a547-7190-810a-30c27d2855c5
title: A source's read mark never falls below a live frame that read it, so a write inside a run scans only frames older than the mark
ord: 34
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a19e65-500e-7822-bece-d7980419984b
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/tracking.ts
    symbol: readDuringRun
---
A tracking frame takes a version from a counter that only grows, and recording a read stamps the source's `read` with the version of the frame that read it. Frames nest, so an inner frame's version is higher than every outer frame's. Every later stamp a source gets while a frame is live comes from that frame, a frame opened inside it, or the reconciliation of one. While a frame is live, a source it recorded therefore keeps a mark at or above that frame's version.

A write made during a run must invalidate every live frame that read the written source, and finding a source in a frame's reads is a scan of that frame's dependency lists. The mark tells which frames need the scan. If the mark is older than the outermost live frame, no live frame read the source and the write checks nothing. A frame that began after the mark did not read it either. Only the remaining frames are scanned.

Anything else that writes `read` must keep that order. Reconciliation briefly stores an edge slot there ([[2f376240]]), which is safe only because no write and no read can happen before the mark is set back.
