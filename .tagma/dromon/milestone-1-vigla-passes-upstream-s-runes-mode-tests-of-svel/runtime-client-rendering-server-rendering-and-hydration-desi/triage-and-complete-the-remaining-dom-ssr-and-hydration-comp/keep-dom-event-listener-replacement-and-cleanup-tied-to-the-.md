---
id: 01a19486-c7ef-73d4-95e3-4249e2b4aa3f
title: Keep DOM event listener replacement and cleanup tied to the registered wrapper
ord: 1
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
  - kind: relates
    to: 01a18680-7dc0-713c-85e6-a5df365e9754
---
Fix the event-attribute-spread-update and event-media-element-cleanup runtime variants at the listener producer and lifecycle owner. Preserve delegated propagation and deferred pointer/touch/wheel registration, check affected recorded entries, and leave shared passing files for the lead.