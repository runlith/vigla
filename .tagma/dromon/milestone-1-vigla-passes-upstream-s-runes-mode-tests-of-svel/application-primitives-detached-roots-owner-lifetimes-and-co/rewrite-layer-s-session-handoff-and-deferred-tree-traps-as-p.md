---
id: 01a1877f-565b-750a-a01b-20dffc1af502
title: Rewrite layer's session-handoff and deferred-tree traps as plain components in project own
ord: 3
tags: ["task"]
fields:
  {
    "holder": "tagma:01a18754-3a91-778c-bdc8-cf0239ed279a",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a18776-8ea8-7aaf-bf46-b802ff96b5e0
  - kind: implements
    to: 01a18776-8e37-7bdc-93a5-7dae8191e72f
---
Two traps of [[8191e72f]] remain unwritten: `patches/svelte@5.57.0.off/packages/layer/src/svelte/session-handoff.svelte.test.ts` (an answer landing after the session key changed reaches the view through the incoming `{#key}` frame, also while that frame awaits a chunk) and `deferred-tree.svelte.test.ts` in the same place, both in `~/runlith/tagma`, read-only. Their fixtures are layer services (`Machine`, `Ledger`, `Search`); rewrite them as plain components and `.svelte.js` state, run each on upstream 5.57.3 and record the result in `harness/manifest/own/runtime.json`. Detached roots (`detached-service-root`) and seat release (`teardown-guard-key`, `teardown-guard-key-flush`) are done.