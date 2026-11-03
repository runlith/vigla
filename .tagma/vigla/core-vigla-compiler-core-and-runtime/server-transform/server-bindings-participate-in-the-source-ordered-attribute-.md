---
id: 01a19542-218b-7d14-b47c-c31ad6f936d8
title: Server bindings participate in the source-ordered attribute collection
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/compiler/server/bindings.ts
  - kind: symbol
    ref: packages/vigla/src/compiler/server/template.ts
    symbol: attributesCall
---
An attribute-producing binding must participate in the same source-ordered collection as surrounding spreads, rather than serialize before them: a separate emission can produce duplicate value or checked attributes, which XHTML rejects and HTML resolves differently. Binding metadata retains its original IR identity so the template emitter can insert its value at the authored position.