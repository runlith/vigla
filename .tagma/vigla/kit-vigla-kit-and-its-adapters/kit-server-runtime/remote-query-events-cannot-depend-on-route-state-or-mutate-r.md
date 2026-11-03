---
id: 01a1946d-d166-73bb-aac7-ebbad2350d6f
title: Remote query events cannot depend on route state or mutate response state
ord: 10
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/server/remote/shared.ts
---
A query's encoded argument must describe the data the browser caches, so its derived event hides URL, params and route. Queries and prerender functions cannot write cookies, and remote functions cannot set response headers; command and form cookie paths must be absolute because the remote URL is not the page URL. Validation and each generator advancement re-enter the captured request explicitly, preserving synchronous lookup on platforms without an async-context port.