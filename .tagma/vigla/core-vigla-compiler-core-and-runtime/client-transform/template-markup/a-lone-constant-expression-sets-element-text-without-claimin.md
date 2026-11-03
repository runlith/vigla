---
id: 01a19426-3e8e-76c9-8962-e2ddc5e4616f
title: A lone constant expression sets element text without claiming a child
ord: 4
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/compiler/client/element.ts
    symbol: elementPart
---
A child-node claim is unnecessary for text that is fixed for the instance. Browser-inserted markup can shift navigation onto a comment: claiming a text child there throws a DOM insertion error before the enclosing hydration boundary can diagnose the mismatch, whereas setting textContent leaves that structural validation in control.