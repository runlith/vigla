---
id: 01a19590-24d0-7a42-afd4-aeb29ed20d4d
title: Dev manifests expose remote registrations made during SSR
ord: 9
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/vite/dev.ts
  - kind: file
    ref: packages/kit/src/vite/remote.ts
  - kind: file
    ref: packages/kit/src/vite/server.ts
---
Remote modules register lazily while routes evaluate, after the dev Server can already exist. Its manifest keeps a live view of the project's entries and loads them through the retained runnable environment; a frozen table makes the first browser call return 404 until an unrelated invalidation.