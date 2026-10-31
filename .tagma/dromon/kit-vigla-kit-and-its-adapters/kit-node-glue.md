---
id: 01a193f1-4da0-78c5-8389-3b987555f955
title: Kit Node glue
ord: 4
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "."
      }
    ],
    "id": "kit-node"
  }
edges:
  - kind: imports
    to: 01a193f1-4d97-7589-b3a8-69aa6c365dd0
sources:
  - kind: dir
    ref: packages/kit/src/node
---
`@sveltejs/kit/node`: turning Node's `IncomingMessage` into a Web `Request` — body size limits, aborts when the client goes away — and writing a Web `Response` onto a `ServerResponse`, draining unread bodies and answering a header Node rejects with a 500. Kit's dev and preview servers and the Node adapter use it; the server runtime itself never does.