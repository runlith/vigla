---
id: 01a19460-3a99-79a4-b17a-64905d3e4077
title: Custom-element properties stay writable from outside the component
ord: 3
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/compiler/analysis/index.ts
    symbol: analyzeComponent
  - kind: symbol
    ref: packages/vigla/src/compiler/client/custom-element.ts
    symbol: accessors
---
A host setter can change a prop the component never reassigns. Analysis therefore treats exposed props as mutable, and the generated component returns their actual accessors, so external writes, local updates and reflected defaults observe the same value.