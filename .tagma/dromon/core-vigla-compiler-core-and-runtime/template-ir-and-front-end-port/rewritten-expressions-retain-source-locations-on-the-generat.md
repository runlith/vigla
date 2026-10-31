---
id: 01a193c6-6107-7463-8df9-a467d87fe7d3
title: Rewritten expressions retain source locations on the generated leaves
ord: 4
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/compiler/ir/estree.ts
  - kind: symbol
    ref: packages/vigla/src/compiler/client/script.ts
    symbol: read
  - kind: symbol
    ref: packages/vigla/src/compiler/client/script.ts
    symbol: effectCallee
  - kind: symbol
    ref: packages/vigla/src/compiler/client/blocks.ts
    symbol: listCode
---
Replacing a source expression must not erase its mapping when it becomes a runtime call or a props read. The ESTree rewrite preserves a replaced node's location; generated identifiers that remain visible to the printer, including props members, effect callees and each parameters, carry the source identifier's location explicitly because mapping a generated parent alone does not map its leaves.