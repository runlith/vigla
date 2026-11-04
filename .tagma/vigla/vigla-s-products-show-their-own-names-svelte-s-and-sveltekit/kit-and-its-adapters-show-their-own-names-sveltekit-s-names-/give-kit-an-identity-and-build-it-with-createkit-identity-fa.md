---
id: 01a1a3ed-6688-7f72-8a35-40aa19294fa4
title: Give Kit an identity and build it with createKit(identity, factory)
ord: 2
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a1a3ed-6688-7f72-8a35-40a5ff420c2e
---
Kit declares its identity type and its own value spelled with `vigla`; build-time code takes it as a value, runtime code through `define`, adapters through the Builder. `@vigla/kit/vite` exports `kit` under Kit's own identity. Kit's own tests move to Kit's names and prove the identity at its public operations.