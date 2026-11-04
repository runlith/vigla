---
id: 01a1a424-e3b4-7654-9dba-ad6e64646332
title: "@vigla/sveltekit types accept every retired call form its wrappers accept"
ord: 4
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1a3f0-acfb-76b3-8128-44f38e95a157",
    "status": "done"
  }
edges:
  - kind: implements
    to: 01a1a3ed-6688-7f72-8a35-40a5ff420c2e
---
`update({ invalidateAll })` in an `enhance` callback fails type-checking under the facade; the facade widens Kit's named option interfaces by declaration merging, so an app type-checks under the facade exactly as under upstream.