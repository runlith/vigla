---
id: 01a1a424-e3b4-7654-9dba-ad6f920b8e9b
title: "@vigla/sveltekit gives handleError's input upstream's deprecated status and message accessors"
ord: 5
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1a3f0-acfb-76b3-8128-44f38e95a157",
    "status": "done"
  }
edges:
  - kind: implements
    to: 01a1a3ed-6688-7f72-8a35-40a5ff420c2e
---
Upstream adds dev-only, non-enumerable `status` and `message` accessors that warn, on the server and the client; neither Kit nor the facade has them, although `harness/manifest/kit/units.json` marks `utils/error.spec.js > add_deprecated_handle_error_properties …` as covered by `kit-shared`. The facade adds them by wrapping the app's `handleError` hooks; the manifest entry names the module that covers it.