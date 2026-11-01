---
id: 01a1958b-14ab-7e05-927d-19664cf0ae85
title: Compiled static listeners retire with their rendering owner
ord: 30
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/events.ts
    symbol: event
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/events.ts
    symbol: delegated
  - kind: symbol
    ref: packages/vigla/src/compiler/client/events.ts
    symbol: event
---
A retained detached node would otherwise keep its handlers' captured application state alive and, if reinserted under a live delegation root, dispatch a handler from the destroyed tree.