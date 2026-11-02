---
id: 01a19405-1074-7436-a650-4ab0a702c1c5
title: Raw snippet HTML is one element so hydration and setup share a stable node
ord: 4
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a18783-3b08-722c-ad34-4c99cf7901ef
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/snippet.ts
  - kind: file
    ref: packages/vigla/src/runtime/server/snippet.ts
  - kind: file
    ref: packages/vigla/src/shared/snippet.ts
---
Raw HTML has no compiler-generated range inside it. A single root element lets the server emit it inline and lets hydration preserve the server node while running setup; trimming both forms prevents leading whitespace from becoming the claimed root. Effects and cleanup created by setup belong to the surrounding rendering owner.