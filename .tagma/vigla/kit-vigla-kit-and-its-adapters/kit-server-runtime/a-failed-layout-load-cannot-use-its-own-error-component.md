---
id: 01a19c8e-775b-7e98-a352-5cc3cd12760b
title: A failed layout load cannot use its own error component
ord: 17
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/server/page.ts
---
A component error response needs a successfully loaded ancestor layout. Rerunning a failed root load can change the outcome after cookies or other application state have been consumed, so an HTML root-load failure uses the static error template. A missing-route fallback may load the root once; a redirect from that load remains an HTTP redirect.