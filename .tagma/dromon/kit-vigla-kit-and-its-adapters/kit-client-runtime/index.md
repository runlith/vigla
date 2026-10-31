---
id: 01a193f7-7564-7052-966b-707c37e1560f
title: Kit client runtime
ord: 10
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "."
      }
    ],
    "id": "kit-client"
  }
edges:
  - kind: imports
    to: 01a18680-7dc2-71f8-be01-915833d45c4b
  - kind: imports
    to: 01a193f1-4d97-7589-b3a8-69aa6c365dd0
  - kind: imports
    to: 01a193f1-4d9b-787a-b261-3bc8d5d68827
  - kind: imports-tests
    to: 01a193f1-4d9c-7780-903d-88cd7526d608
sources:
  - kind: dir
    ref: packages/kit/src/client
---
Kit in the browser: starting an app from the server's payload, hydrating or mounting the root under the tab's owner, the router with link interception, history, scroll and focus restoration and snapshots, the navigation lifecycle, invalidation, preloading of code and data, form enhancement, the `page`, `navigating` and `updated` state, remote-function clients and service-worker registration.