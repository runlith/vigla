---
id: 01a1a3ed-6688-7f72-8a35-40ad2ec9d991
title: Type Kit's configuration by the options of the plugin factory it composes
ord: 5
tags: ["task"]
fields:
  {
    "status": "open"
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