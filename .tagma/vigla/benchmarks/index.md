---
id: 01a187ee-03d4-7edd-b497-3c757ca77bd4
title: Benchmarks
ord: 22
tags: ["module"]
fields:
  {
    "id": "benchmarks",
    "kind": "substrate"
  }
sources:
  - kind: dir
    ref: benchmarks
---
The performance benchmarks the milestone judges Vigla by: ports of upstream's benchmarks written over public API, plus Vigla's own cases, compiled by each target's own compiler and run against both targets on one machine, ten runs each in fresh processes, alternating, medians compared. It owns the benchmark sources and the runner; the targets it measures are the harness's install trees, and the targets the numbers are held to stand in the milestone's performance spec.