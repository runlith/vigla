---
id: 01a19e5c-5397-79af-9331-1e04b45a914c
title: The build runs the app's init hook only when it renders something
ord: 6
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/kit/src/build/prerender.ts
    symbol: prerender
  - kind: symbol
    ref: packages/kit/src/build/runtime.ts
    symbol: loadRuntime
---
An app's `init` may assume a running deployment (databases, secrets), and an app with nothing to prerender legitimately throws from it when `building` is set. Analysis therefore configures the built server without initializing it; prerendering initializes it only once a route resolves to prerender or a remote `prerender` function exists, and the SPA fallback before rendering its shell.