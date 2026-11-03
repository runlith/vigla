---
id: 01a19c75-540b-7e65-b61e-2535d72a2a00
title: Settle stale async readers once across batch commits
ord: 21
tags: ["task"]
fields:
  {
    "holder": "tagma:01a18754-3a91-778c-bdc8-cf0239ed279a",
    "status": "done"
  }
edges:
  - kind: discovered-from
    to: 01a193f2-ff55-75b7-98e3-3cbacd2aed6d
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fac9d5e3831
---
Complete the seven runtime-runes commit/equality samples: async-commit-stale-reader-derived-equality, async-commit-stale-reader-dropped-dep, async-commit-stale-reader-unchanged, async-derived-deferred-clean, async-derived-not-overfiring-2, async-batch-derived and async-dont-rebase-new-batch-3. The current initial run reproduced all 13 available DOM/hydrate failures. The Core producer now validates forced readers against actual values and per-batch async inputs, defers derived evaluation, preserves committed concealment bases, and orders real, speculative and aliased async publications without retaining completed batches. The linked compiler task corrects async text registration while retaining eager hydration claiming.

Delivered in 229a7ceb80b5ad3da5395704d8ef4beecdbcb578: 12 paths and exactly 13 manually added passing ids. Final equality-reviewed-final/svelte.json in the scheduler scratch proves all 13 cohort variants, both async-fork-derived variants and five own async/outgoing controls green. Four new public Core regressions were individually red then green; all four plus ten outgoing-view module controls pass. The compiler task's async-text-controls-ready/svelte.json proves 20 text/hydration controls; core tsrs passes. One independent review identified the same-alias publication, speculative-publication and completed-batch lifetime defects; their confirmed fixes are included. Peer Change.prepare/apply work was excluded from the verified commit slice. No whole-suite or benchmark run was performed for this delivery.
