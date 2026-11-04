---
id: 01a1a3ed-6688-7f72-8a35-40abfc7b0e8d
title: "@vigla/sveltekit supplies SvelteKit's identity"
ord: 3
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1a3f0-acfb-76b3-8128-44f38e95a157",
    "status": "done"
  }
edges:
  - kind: implements
    to: 01a1a3ed-6688-7f72-8a35-40a5ff420c2e
  - kind: waits-on
    to: 01a1a3ed-6688-7f72-8a35-40aa19294fa4
---
The facade declares SvelteKit's identity and exports `sveltekit` built by `createKit` with it and the `svelte` factory, so applications and upstream tests see SvelteKit's names unchanged.