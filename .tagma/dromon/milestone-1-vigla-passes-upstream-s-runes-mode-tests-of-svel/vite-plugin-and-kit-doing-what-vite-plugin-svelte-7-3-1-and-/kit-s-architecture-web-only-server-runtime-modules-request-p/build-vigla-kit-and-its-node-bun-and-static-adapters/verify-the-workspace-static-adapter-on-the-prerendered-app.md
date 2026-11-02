---
id: 01a19d7e-867e-72c7-86de-25c3093fc815
title: Verify the workspace static adapter on the prerendered app
ord: 1
tags: ["task"]
fields:
  {
    "holder": "tagma:01a193e2-1f81-73bf-bca7-d1170e1158da",
    "status": "done"
  }
edges:
  - kind: discovered-from
    to: 01a193e1-7874-7e93-a8a0-d5f7479de14c
  - kind: implements
    to: 01a193ed-396f-73b6-bbe3-bad77aa7b0be
  - kind: waits-on
    to: 01a19d1b-331b-7188-9525-72f5dbd1bc1e
---
Measure exactly the five frozen kit/adapter-static/prerendered test-1/chromium contracts through the existing harness. Switch only the static target alias to workspace:@vigla/adapter-static@*, install with the package manager and verify its ESM realpath. Preserve Node/Bun aliases, fixture bodies and PUBLIC_ANSWER=42; use one worker, a vacant localhost:5174 and no existing-server reuse. Capture source/WIP/input provenance, actual first/retry/fail/skip/missing outcomes and cleanup. This is one build-plus-static-listener app run, not SPA, staging/styles, compiled Bun or general production acceptance. Execution 41d877b1 passed all five on first attempt with a retained complete build. Source qualification against accepted Core landings matched the shared mount/effect producers and resolved remaining differences as formatting-only or unreachable in the retained production output. Exactly five rows landed in 6d09ea21200329b708f2dead47dffc29130fae83; this remains witnessed shared-tree acceptance of the named app and variant, not a new clean-HEAD run or broader static/geometry acceptance.