---
id: 01a19c2b-2b51-7beb-9117-1b179e07f15e
title: Page prerender and action incompatibility is a request failure
ord: 3
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/build/analysis.ts
  - kind: file
    ref: packages/kit/src/server/page.ts
---
The server must produce this failure so the application's error response and the crawler's HTTP-error policy can handle it. Metadata analysis retains the page's prerender mode and action methods; rejecting their combination there would abort a build even when no entry reaches that route.