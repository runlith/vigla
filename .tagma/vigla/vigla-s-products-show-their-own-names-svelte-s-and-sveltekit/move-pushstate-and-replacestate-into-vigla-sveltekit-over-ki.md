---
id: 01a1a424-e3b4-7654-9dba-ad6d84c4435e
title: Move pushState and replaceState into @vigla/sveltekit over Kit's shallow goto
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
---
Upstream 3.1 deprecates both in favour of `goto(url, { state, shallow: true })`, so they are upstream's history: Kit's `$app/navigation` drops them, the facade's wrapper module implements them over Kit's `goto` with upstream's warning.