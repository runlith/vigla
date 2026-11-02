---
id: 01a19d95-4f63-7704-965a-0c74d2acf1f2
title: Internal fetches inherit the calling page's prerender default
ord: 20
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/server/endpoint.ts
  - kind: file
    ref: packages/kit/src/server/page.ts
  - kind: file
    ref: packages/kit/src/server/respond.ts
---
An endpoint with no explicit declaration can be a deployment dependency solely because a prerendered load fetches it. Losing the page's default at subrequest creation rejects that valid dependency; explicit endpoint declarations remain authoritative.