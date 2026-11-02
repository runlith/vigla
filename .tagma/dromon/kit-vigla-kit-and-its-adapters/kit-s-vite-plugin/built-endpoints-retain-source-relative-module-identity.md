---
id: 01a19c9c-0cc7-79f0-b291-c940cbe1d258
title: Built endpoints retain source-relative module identity
ord: 11
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/kit/src/vite/build.ts
    symbol: buildPlugin
---
Applications may use import.meta.url to associate an endpoint with its neighboring route modules. Source-relative entry directories and module names keep that identity meaningful after bundling; ordinal output names make those relationships depend on route-table ordering and break endpoint consumers.