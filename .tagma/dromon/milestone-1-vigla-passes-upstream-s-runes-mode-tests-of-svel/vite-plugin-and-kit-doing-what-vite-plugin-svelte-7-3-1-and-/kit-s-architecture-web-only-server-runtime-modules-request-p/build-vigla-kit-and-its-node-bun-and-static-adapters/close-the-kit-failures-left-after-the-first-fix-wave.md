---
id: 01a19e9c-75e8-7fbb-a31a-95fc00484936
title: Close the Kit failures left after the first fix wave
ord: 7
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e4c-b4f3-7e07-8f01-7de0ca16c340",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a19e4c-6062-7b6e-b383-36b52ad51ae8
  - kind: implements
    to: 01a193ed-396f-73b6-bbe3-bad77aa7b0be
---
Left open by the build and client streams: options-2 worker `$app/manifest` lists the CSS bundle as `immutable[0]` instead of the JS bundle; options-3 inline-bundle timeouts; no-csr `omits client build output`; async `query redirects on page load (query in common layout)` failing only in test-build-2; a failing server-data refetch on the root error page renders without data where upstream navigates natively. Determine each producer from traces, fix it there, record what passes.