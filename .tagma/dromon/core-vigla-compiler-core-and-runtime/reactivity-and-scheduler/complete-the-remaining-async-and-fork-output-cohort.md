---
id: 01a19d1b-331b-7188-9525-72f5dbd1bc1e
title: Complete the remaining async and fork output cohort
ord: 24
tags: ["task"]
fields:
  {
    "holder": "tagma:01a18754-3a91-778c-bdc8-cf0239ed279a",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a193f2-ff55-75b7-98e3-3cbacd2aed6d
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fac9d5e3831
---
Recheck the exact 20 variants in async-batch-fork-output from compat-refresh's owner-clusters.json after the latest equality, locality and owner-restoration fixes. The cohort covers async-await, async-effect-pending-eager, async-error, async-fork, fork attributes/writable/equal-result/failure/nested-branch cases, and overlapping arrays/batches. Fix still-wrong Core producers while preserving outgoing, equality, cancellation and application-owner contracts; identify compiler/DOM first-loss boundaries explicitly before expanding there. Land manually added passing ids with source, or record already-green cases from applicable current evidence. Do not weaken modes/assertions or change unrelated layout WIP.