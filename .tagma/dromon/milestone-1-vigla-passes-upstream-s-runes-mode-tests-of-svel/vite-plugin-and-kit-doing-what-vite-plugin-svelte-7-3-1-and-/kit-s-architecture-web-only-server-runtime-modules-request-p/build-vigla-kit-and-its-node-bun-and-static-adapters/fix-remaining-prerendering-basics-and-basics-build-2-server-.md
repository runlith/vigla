---
id: 01a19e72-f50d-7bc5-a16f-82e1a43ed574
title: Fix remaining prerendering/basics and basics build-2 server rendering failures
ord: 6
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e4c-b4f3-7e07-8f01-7de0ca16c340",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a19e4c-6062-7b6e-b383-36b34a59cf5c
  - kind: implements
    to: 01a193ed-396f-73b6-bbe3-bad77aa7b0be
---
Leftovers of 4a59cf5c: prerendering/basics `__route.js` modules, `redirect-server/__data.json`, the two cache-control meta-tag entries and the relative service worker; basics test-build-2 `$app/forms deserialize works on the server` (500) and `asset preload injects <link> tags` (no `modulepreload`). Also add unit regressions for escaped-route `*` seeding and resolved prerender redirect metadata. Fix at the producer and record the rows.