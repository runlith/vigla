---
id: 01a18687-b44d-720f-8b8d-0e1091aef644
title: No file of `packages/dromon` names the `svelte` package
ord: 10
tags: ["rule"]
fields:
  {
    "enforcement": {
      "debt": [],
      "escaped": [],
      "inspection": "core-names-no-svelte",
      "on": [
        {
          "op": "submit_work",
          "phase": "before"
        },
        {
          "op": "merge_worktree",
          "phase": "before"
        }
      ],
      "strictness": "gate"
    }
  }
edges:
  - kind: relates
    to: 01a18605-d03d-737c-9a72-8cc4b3360999
sources:
  - kind: dir
    ref: packages/vigla
---
No import of `svelte` or `svelte/*` — type imports and type references included — no `declare module 'svelte…'`, and no `svelte` in its manifests. Svelte compatibility lives in `@dromon/svelte`, which reaches the core through its front-end port and published entries.