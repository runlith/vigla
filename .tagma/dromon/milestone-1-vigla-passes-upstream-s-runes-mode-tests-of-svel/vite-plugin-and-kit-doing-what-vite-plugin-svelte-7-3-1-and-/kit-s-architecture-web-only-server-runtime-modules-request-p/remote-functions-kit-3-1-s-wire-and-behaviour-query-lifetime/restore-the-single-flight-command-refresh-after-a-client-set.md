---
id: 01a19586-032c-7959-a5b3-d87129b0199a
title: Restore the single-flight command refresh after a client set
ord: 3
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1945b-1c58-71fb-adba-35b832991389",
    "status": "in_work"
  }
---
Locate the seam losing a server-initiated query refresh during a command, reproduce the async app's reset failure with the upstream wire contract, and fix its producer. Verify the same scoped app picks with Kit's approval before recording first-attempt passes.