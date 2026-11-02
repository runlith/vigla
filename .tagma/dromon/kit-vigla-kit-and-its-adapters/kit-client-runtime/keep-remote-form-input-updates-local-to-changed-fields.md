---
id: 01a19ce1-79dd-70bd-bb4c-7359a6d8c2c3
title: Keep remote form input updates local to changed fields
ord: 17
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1945b-1c58-71fb-adba-35b832991389",
    "status": "done"
  }
edges:
  - kind: implements
    to: 01a1945a-6dcb-7f88-ba1f-c9b4d274a460
---
Preserve untouched native controls when another remote form field changes. Keep field projections reactive at property granularity while retaining immutable value snapshots, whole-form replacement, reset, touched and preflight semantics; prove the select contract through the public remote form and native DOM without a browser run.