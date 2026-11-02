---
id: 01a19459-a9ad-7268-8d0c-a5e3e51ed7ae
title: Prerender query access follows the request's live reroute state
ord: 6
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/server/load.ts
  - kind: file
    ref: packages/kit/src/server/respond.ts
  - kind: file
    ref: packages/kit/src/server/url.ts
---
Prerendered output is selected by pathname, so request hooks, endpoints and loads cannot depend on query strings. Reroute may fetch query-dependent API data to choose that pathname; its temporary state therefore permits query access during those internal requests. Original and normalized data-event URLs reject queries during prerendering; tracked server-load URLs also reject them for routes declared prerenderable. Ordinary hook URL access stays available when serving those routes dynamically, and load URL wrapping preserves dependency tracking.