---
id: 01a193f7-7562-7aff-a349-f485e6941c8e
title: Kit server runtime
ord: 9
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "."
      }
    ],
    "id": "kit-server"
  }
edges:
  - kind: imports
    to: 01a18680-7dc2-71f8-be01-915833d45c4b
  - kind: imports
    to: 01a193f1-4d97-7589-b3a8-69aa6c365dd0
  - kind: imports
    to: 01a193f1-4d9b-787a-b261-3bc8d5d68827
sources:
  - kind: dir
    ref: packages/kit/src/server
---
Kit's `Server`: it answers a Web `Request` with a `Response` — routing, hooks, endpoints, form actions, server and universal `load`, server rendering into the app's document with its payload and streamed data, data and route-resolution requests, remote-function calls, cookies, CSRF and CSP — running each request under a request owner of the core. It uses Web APIs only; whatever a platform must supply arrives through `init` and the request options.