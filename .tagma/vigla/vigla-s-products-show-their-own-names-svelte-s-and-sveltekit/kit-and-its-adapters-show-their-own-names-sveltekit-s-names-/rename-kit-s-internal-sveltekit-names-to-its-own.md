---
id: 01a1a3ed-6688-7f72-8a35-40a9957e6916
title: Rename Kit's internal SvelteKit names to its own
ord: 1
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a1a3ed-6688-7f72-8a35-40a5ff420c2e
---
Build-time constants, the bundle global and chunk names, synthetic module ids, internal origins and the files Kit writes for itself — names no application, library or upstream test reads — take Kit's own names, with no parameter.