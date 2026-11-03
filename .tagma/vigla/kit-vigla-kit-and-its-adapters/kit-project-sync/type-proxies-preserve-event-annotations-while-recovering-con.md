---
id: 01a1940d-7ecb-7c42-9a29-758356383431
title: Type proxies preserve event annotations while recovering concrete load and action results
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/sync/proxy.ts
  - kind: file
    ref: packages/kit/src/sync/route-types.ts
---
A broad load or actions annotation supplies useful event types but hides the concrete returned properties needed by PageData and ActionData. Sync writes type-only proxy modules beside the generated route declarations, moving annotations to events while allowing return inference; the application's source stays unchanged. Relative source imports are retargeted, while $types imports remain beside the proxy to break the inference cycle through generated declarations.