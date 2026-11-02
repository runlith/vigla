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
Applications may inspect import.meta.url to recognize an endpoint's route directory and module name. Source-relative output keeps that identity meaningful after bundling; ordinal names make it depend on route-table ordering and break consumers that validate where an endpoint call originated.