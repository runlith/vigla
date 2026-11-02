---
id: 01a19e60-bf7e-7f3c-9dd3-4a9dae1eea69
title: An internal request's owner is independent of its caller's
ord: 21
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/server/scope.ts
---
A `fetch` from a load or endpoint answers a `Response` its caller may hand on: the prerenderer reads a page's same-origin dependencies only after the page's own response has ended, and a load may return a response it never read. The core releases a child root with its parent, so a sub-request owner parented to the calling request's owner would be disposed when that caller finishes, and pulling the still-unread body under it fails. Each internal request therefore gets its own root, released only when its own body ends, is cancelled or its request aborts.