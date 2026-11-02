---
id: 01a19c8b-9fb6-7fe1-9be6-cf0852a4a26a
title: Preview separates startup assets from request assets
ord: 10
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/vite/preview.ts
---
Application startup reads bundled server assets, while request-time internal fetches must also reach the deployed static files ahead of overlapping endpoints. Preview keeps those read capabilities separate so the built client snapshot is used without changing the server module's initialization contract.