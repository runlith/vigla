---
id: 01a1946b-0bd9-71ff-9737-7bb889bb23bf
title: Keep one core instance across framework source and frontend prebundles
ord: 3
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a193ed-396f-73b6-bbe3-bad77aa7b0be
  - kind: relates
    to: 01a19417-ef1d-76c1-9d8c-be96f41e1337
---
Prevent a frontend's optimized runtime from bundling a second `vigla` instance while framework code imports the core from source. Keep the core shared across every optimizer environment without requiring alias-only apps to declare a new direct dependency. Prove the native owner is visible through a frontend's actual prebundle, then confirm Kit's hydration and the recorded plugin e2e set when the heavy-run slot is available.