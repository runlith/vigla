---
id: 01a19558-ff02-79fa-b62e-6787eb5d8567
title: Remote prerender inputs seed a crawl whose calls share one result
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/server/remote/prerender.ts
  - kind: symbol
    ref: packages/kit/src/build/prerender.ts
    symbol: prerender
---
Input generators are seeds, so a prerendered page may contribute an argument absent from them. The crawl owns one promise map keyed by the complete remote URL: page calls, explicit inputs and later pages must agree on one value even when the function has side effects. Static remote dependencies use the same result envelope and transport as a remote GET and live in data output, allowing adapters to serve them without executing the server implementation.