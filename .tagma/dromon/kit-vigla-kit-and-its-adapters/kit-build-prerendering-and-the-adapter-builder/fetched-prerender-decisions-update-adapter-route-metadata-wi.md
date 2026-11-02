---
id: 01a19db5-6fe8-73de-baa7-62806df09468
title: Fetched prerender decisions update adapter route metadata without replacing auto
ord: 4
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/build/builder.ts
  - kind: file
    ref: packages/kit/src/build/prerender.ts
---
Fetched output may be the only visit to an implicit endpoint, so the crawl carries its decoded route identity and response decision into the adapter's route map as well as the output files. An existing `auto` decision retains dynamic serving for paths the crawl did not cover; files and concrete URLs alone cannot establish a route's deployment mode.