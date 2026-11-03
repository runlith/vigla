---
id: 01a1a174-bc64-7403-9237-4871ff5487f3
title: A throwing transformPageChunk ends the request in the static error page
ord: 24
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/server/document.ts
---
The transformer is application code run once over a finished document; when it throws, its own state is already advanced. Rendering the app's error page would hand the same transformer a second document it cannot tell apart from the first (Kit #14063), so the failure marks the request as already in error and answers the `error.html` template, reporting the error to `handleError` once. The rejected alternative, rendering the error page without the transformer, would ship a document the app never post-processed.