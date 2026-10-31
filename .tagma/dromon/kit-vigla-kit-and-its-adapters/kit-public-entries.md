---
id: 01a193f1-4d9c-7780-903d-88cd7526d608
title: Kit public entries
ord: 3
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "."
      }
    ],
    "id": "kit-entries"
  }
edges:
  - kind: imports
    to: 01a193f1-4d97-7589-b3a8-69aa6c365dd0
  - kind: imports
    to: 01a193f1-4d9b-787a-b261-3bc8d5d68827
sources:
  - kind: dir
    ref: packages/kit/src/entries
---
What an app imports from Kit: `@sveltejs/kit` and its `hooks`, `params`, `env` and `adapter` subpaths, and the `$app/*` and `$env/*` modules as pairs of client and server files the package's import conditions choose between. Each file projects the client or server runtime under Kit 3.1's public names; the behaviour lives in those runtimes.