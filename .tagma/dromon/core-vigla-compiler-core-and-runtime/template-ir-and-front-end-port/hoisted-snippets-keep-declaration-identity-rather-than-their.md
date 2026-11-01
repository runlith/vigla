---
id: 01a1954e-4184-73dd-93bb-c45bfe22f7ea
title: Hoisted snippets keep declaration identity rather than their source spelling
ord: 5
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/compiler/ir/estree.ts
    symbol: Names
  - kind: symbol
    ref: packages/vigla/src/compiler/client/script.ts
    symbol: read
  - kind: symbol
    ref: packages/vigla/src/compiler/server/script.ts
    symbol: rewrite
  - kind: file
    ref: packages/vigla/src/compiler/client/component.ts
  - kind: file
    ref: packages/vigla/src/compiler/server/component.ts
---
Snippets from separate lexical fragments may share a source name while generation lifts them into one function or module scope. A generated name therefore belongs to the original declaration identity; declarations, references, component prop values and boundary handlers use the same allocation on client and server. Authored prop keys remain unchanged, and renamed identifier leaves retain their source locations.