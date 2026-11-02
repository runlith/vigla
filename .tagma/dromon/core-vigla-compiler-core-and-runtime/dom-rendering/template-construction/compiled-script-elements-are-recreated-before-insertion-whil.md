---
id: 01a19c4f-3497-780a-8466-75b98a6014d7
title: Compiled script elements are recreated before insertion while raw HTML stays inert
ord: 2
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/template.ts
    symbol: fragment
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/template.ts
    symbol: activateScripts
  - kind: symbol
    ref: packages/vigla/src/compiler/client/template.ts
    symbol: render
---
Parsing a template makes its scripts inert, so cloning alone cannot execute authored script elements. The compiler marks those fragments for recreation before insertion, keeping ordinary templates off that scan path. Raw-HTML fragments are not marked, and hydration claims existing scripts without executing them again; standalone script templates must return the recreated node so their owner still removes the live script.