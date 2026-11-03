---
id: 01a19c40-c531-79f4-af7c-3542c1ed4474
title: Publish nested query seeds into SSR hydration
ord: 14
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
A query that seeds another query with set() must publish the child value in the SSR document even when only the parent is awaited. Trace the public remote API through Server.respond and core hydration, add a minimal red-to-green regression, and correct publication at the server producer without changing client fetch behavior or query-event restrictions.