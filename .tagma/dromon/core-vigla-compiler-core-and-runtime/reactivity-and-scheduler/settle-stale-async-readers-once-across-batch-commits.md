---
id: 01a19c75-540b-7e65-b61e-2535d72a2a00
title: Settle stale async readers once across batch commits
ord: 21
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a193f2-ff55-75b7-98e3-3cbacd2aed6d
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fac9d5e3831
---
Complete the remaining runtime-runes commit/equality cohort: async-commit-stale-reader-derived-equality, async-commit-stale-reader-dropped-dep, async-commit-stale-reader-unchanged, async-derived-deferred-clean, async-derived-not-overfiring-2, async-batch-derived and async-dont-rebase-new-batch-3. Recheck the retained failures on the current tree, fix the producer of duplicate or missing runs while preserving the scheduler invariants, and land manually added passing ids with their supporting code. Retained per-variant failures and report paths are in the blocks scratch runtime-remainder-current.json; already-green current cases need no invented producer change.