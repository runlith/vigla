---
id: 01a19d7e-867e-72c7-86de-25c3093fc815
title: Verify the workspace static adapter on the prerendered app
ord: 1
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a193e1-7874-7e93-a8a0-d5f7479de14c
  - kind: implements
    to: 01a193ed-396f-73b6-bbe3-bad77aa7b0be
---
Measure exactly the five frozen kit/adapter-static/prerendered test-1/chromium contracts through the existing harness. Switch only the static target alias to workspace:@vigla/adapter-static@*, install with the package manager and verify its ESM realpath. Preserve Node/Bun aliases, fixture bodies and PUBLIC_ANSWER=42; use one worker, a vacant localhost:5174 and no existing-server reuse. Capture source/WIP/input provenance, actual first/retry/fail/skip/missing outcomes and cleanup. This is one build-plus-static-listener app run, not SPA, staging/styles, compiled Bun or general production acceptance.