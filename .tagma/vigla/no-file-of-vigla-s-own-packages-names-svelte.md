---
id: 01a1a3ed-6688-7f72-8a35-40a6c1f8c24d
title: No file of Vigla's own packages names Svelte
ord: 30
tags: ["rule"]
fields:
  {
    "enforcement": {
      "debt": [
        {
          "count": 4,
          "fingerprint": "products-name-no-svelte names svelte @ packages/kit/src/config/errors.ts",
          "owner": "1ac4162a"
        },
        {
          "count": 2,
          "fingerprint": "products-name-no-svelte names svelte @ packages/kit/src/config/warnings.ts",
          "owner": "1ac4162a"
        },
        {
          "count": 2,
          "fingerprint": "products-name-no-svelte names svelte @ packages/kit/src/vite/index.ts",
          "owner": "1ac4162a"
        },
        {
          "count": 4,
          "fingerprint": "products-name-no-svelte names svelte @ packages/kit/src/vite/messages.ts",
          "owner": "1ac4162a"
        }
      ],
      "escaped": [],
      "inspection": "products-name-no-svelte",
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
    to: 01a1a3ed-6688-7f72-8a35-40a5ff420c2e
  - kind: supersedes
    to: 01a18687-b44d-720f-8b8d-0e1091aef644
sources:
  - kind: dir
    ref: packages/adapter-bun
  - kind: dir
    ref: packages/adapter-node
  - kind: dir
    ref: packages/adapter-static
  - kind: dir
    ref: packages/kit
  - kind: dir
    ref: packages/vigla
  - kind: dir
    ref: packages/vite-plugin
---
The core `vigla`, `@vigla/vite-plugin`, `@vigla/kit` and the `@vigla/adapter-*` packages contain the word `svelte` in no case and no form — `sveltekit`, `svelte-kit` and `__SVELTEKIT_` included — in code, strings, file names, manifests or messages. A name of Svelte, vite-plugin-svelte or SvelteKit that an application needs is supplied by the compatibility package standing in for that upstream: `@vigla/svelte`, `@vigla/vite-plugin-svelte` or `@vigla/sveltekit`. Tests are exempt.