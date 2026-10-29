---
id: 01a18796-7c71-7c91-be0d-715f73223041
title: Turn the remaining scheduler traps green on Dromon once keyed blocks, attachments and pending boundaries render
ord: 3
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a18752-ff03-7988-bdb3-d50e5e2ef4a9
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fac9d5e3831
  - kind: waits-on
    to: 01a18752-ff03-7988-bdb3-d51034d8c1ab
---
Five own traps of [[9d5e3831]] are written, red on upstream 5.57.3 as recorded in `harness/manifest/own/runtime.json`, and not yet green on Dromon because the template features they use do not render yet:
- `async-branch-removal`, `teardown-guard-key` and `teardown-guard-key-flush` need `{#key}`;
- `teardown-guard-rows` needs `{@attach}`;
- `async-mount-window-pending` and `-blocking` compile, but the `<svelte:boundary>` holding a component with a top-level `await` renders neither its pending snippet nor its content. The detached probe's logs are already correct.

Run each once render's side exists. A failure that remains is a scheduler defect to fix in `runtime/reactivity`. Record each entry as it passes.