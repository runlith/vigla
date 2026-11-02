---
id: 01a193c4-8c02-7dfd-83a3-3570e7bdcd35
title: Boundary fallback snippets keep the boundary's lexical scope
ord: 2
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/compiler/client/component.ts
    symbol: boundaryCall
  - kind: symbol
    ref: packages/vigla/src/compiler/server/component.ts
    symbol: boundary
---
Sibling and nested boundaries may each declare a `failed` or `pending` snippet. Their declarations and the call handing them to the runtime share a lexical block, so one boundary cannot replace another's fallback and the server never emits colliding function declarations.