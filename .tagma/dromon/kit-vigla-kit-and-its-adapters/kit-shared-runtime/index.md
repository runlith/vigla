---
id: 01a193f1-4d9b-787a-b261-3bc8d5d68827
title: Kit shared runtime
ord: 2
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "diagnostics.ts"
      },
      {
        "at": "errors.ts"
      },
      {
        "at": "warnings.ts"
      },
      {
        "at": "outcomes.ts"
      },
      {
        "at": "pathname.ts"
      },
      {
        "at": "redirect.ts"
      },
      {
        "at": "routing/index.ts"
      },
      {
        "at": "http.ts"
      },
      {
        "at": "escape.ts"
      },
      {
        "at": "hash.ts"
      },
      {
        "at": "serialization.ts"
      },
      {
        "at": "env.ts"
      }
    ],
    "id": "kit-shared"
  }
edges:
  - kind: imports
    to: 01a193f1-4d97-7589-b3a8-69aa6c365dd0
sources:
  - kind: dir
    ref: packages/kit/src/shared
---
What Kit's client, server and build all run: route ids, patterns and params, the URL rules (base path, trailing slash, data and route suffixes), the HTTP outcomes `error`, `redirect` and `fail` throw or return, transport encoding over `devalue`, escaping, and the diagnostics every Kit message is raised through. It uses Web APIs only, so the browser and every server platform load it unchanged.