---
id: 01a19c63-2135-7558-9e71-5d1d34f3c757
title: Publish nested SSR query refreshes before hydration
ord: 15
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1945b-1cd7-768d-8333-42a4bfe6839d",
    "status": "done"
  }
edges:
  - kind: implements
    to: 01a1945a-6dcb-7f88-ba1f-c9b4d274a460
---
An explicit query refresh requested inside an SSR parent query must finish and publish its child node even when the child is never awaited during rendering. Reuse the server collector, preserve deferred mutation semantics and accepted set seeds, and prove the result through Server.respond without changing client hydration or core behavior.