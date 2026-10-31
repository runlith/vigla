---
id: 01a19459-a9ad-7268-8d0c-a5e3e51ed7ae
title: Prerender query access follows the request's live reroute state
ord: 6
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/server/url.ts
  - kind: file
    ref: packages/kit/src/server/respond.ts
  - kind: file
    ref: packages/kit/src/server/load.ts
---
Prerendered output is selected by pathname, so request hooks, endpoints and loads cannot depend on query strings. Reroute may fetch query-dependent API data to choose that pathname; its temporary state therefore permits query access during those internal requests. The same policy wraps original event URLs, normalized data-request URLs and tracked load URLs, preserving ordinary URL access and dependency tracking outside prerendering.