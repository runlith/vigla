---
id: 01a193f1-4da0-78c5-8389-3b987555f955
title: Kit Node glue
ord: 4
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "index.ts"
      },
      {
        "at": "static.ts"
      }
    ],
    "id": "kit-node"
  }
edges:
  - kind: imports
    to: 01a193f1-4d97-7589-b3a8-69aa6c365dd0
  - kind: imports
    to: 01a193f1-4d9b-787a-b261-3bc8d5d68827
sources:
  - kind: dir
    ref: packages/kit/src/node
---
The Node boundary used by Kit's dev and preview servers and the Node adapter: requests become Web `Request`s with body limits and aborts, responses drain unread bodies and honor backpressure, and static files share one HTTP conditional and byte-range contract. The public `@sveltejs/kit/node` surface keeps Kit's request/response names; internal static serving is published separately. The server runtime receives Web capabilities and never loads this module.