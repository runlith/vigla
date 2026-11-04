---
id: 01a1a3ed-6688-7f72-8a35-40a81ac4162a
title: Kit and its adapters show their own names; SvelteKit's names and history move into @vigla/sveltekit
ord: 2
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1a3f0-acfb-76b3-8128-44f38e95a157",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a1a3ed-6688-7f72-8a35-40a5ff420c2e
---
Remove every occurrence of `svelte` from `packages/kit` and `packages/adapter-*` outside tests, as the spec divides them: internal names renamed, the visible contract behind Kit's identity, upstream's history in the facade. Owns the `products-name-no-svelte` debt of those packages.