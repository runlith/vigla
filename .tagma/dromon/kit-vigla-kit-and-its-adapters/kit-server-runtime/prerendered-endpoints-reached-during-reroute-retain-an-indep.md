---
id: 01a19c35-f9fe-736b-aae8-08487d942e77
title: Prerendered endpoints reached during reroute retain an independent crawl response
ord: 13
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/server/endpoint.ts
  - kind: file
    ref: packages/kit/src/build/prerender.ts
---
A reroute fetch may be the only path reaching a parameterized prerendered endpoint. The server retains a separately readable response with its route identity for the crawler because the hook consumes its own response before load replay exists; without that producer record the static file is missing and unseen-route validation fails.