---
id: 01a19477-067a-732a-8359-248221af373c
title: Frontend prebundles externalize the core to keep owner state shared
ord: 4
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a187cb-043a-7c9c-8057-8594c18ff125
sources:
  - kind: symbol
    ref: packages/vite-plugin/src/plugins/optimizer.ts
    symbol: setupOptimizer
---
A framework can import the core from source while its components import an optimized frontend runtime. Inlining the core into that runtime would duplicate owners, contexts, signals and hydration cursors. During serve, the default optimizer configuration excludes `vigla` and its subpaths in each environment, leaving ordinary package resolution intact; forcing deduplication from the app root would require alias-only apps to declare a direct core dependency they otherwise do not need.