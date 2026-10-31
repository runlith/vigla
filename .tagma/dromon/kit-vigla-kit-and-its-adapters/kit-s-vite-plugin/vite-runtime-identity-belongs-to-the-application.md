---
id: 01a1944c-8a95-7d99-b8ae-bc611635cd49
title: Vite runtime identity belongs to the application
ord: 3
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/vite/paths.ts
  - kind: file
    ref: packages/kit/src/vite/project.ts
  - kind: file
    ref: packages/kit/src/vite/index.ts
  - kind: file
    ref: packages/kit/src/vite/env.ts
  - kind: file
    ref: packages/kit/src/vite/dev.ts
---
An app and a linked Kit package can resolve different installations of Vite. Testing an app environment against Kit's constructor would reject a usable runner, so the boundary checks the runner's callable import operation and resolves the complete Vite API from the app root. Environment discovery and runtime helpers use that retained API; build workers evaluate bundled output without importing a Vite runtime.