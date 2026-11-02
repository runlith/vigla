---
id: 01a1959d-9fc2-7b3b-99c3-3938445fb5dc
title: Instance export mutability follows the binding rather than a copied value
ord: 19
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/compiler/analysis/index.ts
    symbol: analyzeComponent
  - kind: symbol
    ref: packages/vigla/src/compiler/analysis/scope.ts
    symbol: Binding
  - kind: symbol
    ref: packages/vigla/src/compiler/client/custom-element.ts
    symbol: customElement
  - kind: symbol
    ref: packages/vigla/src/compiler/client/index.ts
    symbol: exportProperties
---
Writable instance exports must update their original prop or state cell, including through an alias; ordinary const exports keep a getter, while const state bindings still expose their mutable cell value. Props and state exposed this way are treated as externally assigned before generation, so local source-code assignments are not the only reason to retain their write path. Ordinary let/var exports keep JavaScript assignment semantics, and async publication forwards the same getter/setter pair. Custom-element export names remain unique even though one property can now supply two accessor definitions.