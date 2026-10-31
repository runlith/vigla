---
id: 01a1945e-c862-7e94-81c5-f0573d5f574a
title: Remote IDs and server chunks share one identity
ord: 4
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/vite/remote.ts
---
Client stubs, server registration and the built manifest must use the same root-relative file hash and export name; a mismatch silently directs a call to the wrong or missing function. Dedicated namespace entry chunks let build analysis and the request handler load the same exports without imposing manual chunk ordering on the app graph.