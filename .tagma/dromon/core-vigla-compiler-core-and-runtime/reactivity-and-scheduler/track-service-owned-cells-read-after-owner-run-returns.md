---
id: 01a19cf3-620f-7990-8c34-08fa3dc2cceb
title: Track service-owned cells read after Owner.run returns
ord: 23
tags: ["task"]
fields:
  {
    "holder": "tagma:01a18754-3a91-778c-bdc8-cf0239ed279a",
    "status": "done"
  }
edges:
  - kind: discovered-from
    to: 01a193e1-7874-7e93-a8a0-d5f7479de14c
  - kind: implements
    to: 01a18776-8e37-7bdc-93a5-7dae8191e72f
---
Fix the Core producer that treated a cell created by service.run(() => cell(0)) as local to the calling derived, even though state.current is read only after that owner run returns. Leaving reactive context now suspends the caller's creation scope as well as reading/execution; ordinary untrack and derived evaluations opened inside the separate context retain their own locality. No Kit refresh or normalizer is used.

Delivered in a565ca31bf: tracking.ts and one public-entry regression in owners.test.ts, owned by reactivity with a test-only entries relation. The exact retained owned-cell-derived.mjs and the new module test both failed 0 != 1 before and pass after; the exact script now prints direct:1,derived:1,shown:1. Eleven owner/outgoing module tests and core tsrs pass. Under this thread's scratch, owned-cell-local-state/svelte.json proves 18 recorded collection/local/untracked-local variants; owned-cell-owner-controls/svelte.json proves 13 recorded Owner/root/outgoing controls (14 assertions). One independent review found no actionable defects. Kit separately reported its retained form-first-issues.mjs red rendered:null to green with matching direct/rendered issue arrays, on the same shared source fix. Its browser check is separate and was not run here. Full runtime, benchmarks and the remaining compatibility-ledger scopes were not run or taken.
