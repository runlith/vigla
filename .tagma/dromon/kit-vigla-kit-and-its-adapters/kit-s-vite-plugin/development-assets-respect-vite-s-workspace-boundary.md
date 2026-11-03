---
id: 01a1a169-14c8-791e-b259-72ebac5dbfb6
title: Development assets respect Vite's workspace boundary
ord: 16
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/vite/index.ts
---
A linked workspace package can put a stylesheet's assets outside the application directory. The default filesystem allowance includes the application's Vite workspace so those assets remain reachable; an explicit `server.fs.allow` suppresses that default so it cannot widen the application's chosen boundary.