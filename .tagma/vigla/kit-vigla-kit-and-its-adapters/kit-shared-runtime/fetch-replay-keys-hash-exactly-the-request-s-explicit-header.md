---
id: 01a19408-653d-735f-ae75-f6292c09f7ab
title: Fetch replay keys hash exactly the request's explicit headers and body
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/shared/hash.ts
---
The server's fetched-response script and the browser's cache lookup must derive the same key from explicit request headers and body bytes, including a typed-array view's offset and length. The hash therefore keeps the upstream wire algorithm; changing it on one side would silently repeat hydration fetches, and inherited server credentials must never enter the browser's lookup key.