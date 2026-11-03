---
id: 01a19c84-048b-7457-8a11-a38283f001fe
title: Correct selective goto invalidation and production deprecations
ord: 15
tags: ["task"]
fields:
  {
    "holder": "tagma:01a193f9-8b76-7543-92f4-24aa31ce74ab",
    "status": "done"
  }
edges:
  - kind: relates
    to: 01a19c88-40b5-7fd0-8afd-388a3f9937b6
---
Restore selective same-URL navigation without retaining action outcomes or failed load branches, and confine deprecated replacement warnings to development. The final affected public cases passed 15/15, development/production diagnostics passed 2/2, and Kit tsrs passed; the one independent review's confirmed finding was fixed with public red→green coverage. Reset POST output identity and the document-reload root fallback were handed to the Vite/build and server owners. No production browser pass or passing-row eligibility is established.