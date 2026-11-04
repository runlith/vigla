---
id: 01a1a3ed-6688-7f72-8a35-40ad2ec9d991
title: Type Kit's configuration by the options of the plugin factory it composes
ord: 5
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
    to: 01a1a3ed-6688-7f72-8a35-40a7baff1c75
  - kind: waits-on
    to: 01a1a3ed-6688-7f72-8a35-40aa19294fa4
---
`createKit` is generic over its factory's options, so `kit({...})` takes the Vite plugin's own option names and `sveltekit({...})` upstream's, through `@vigla/vite-plugin-svelte`.