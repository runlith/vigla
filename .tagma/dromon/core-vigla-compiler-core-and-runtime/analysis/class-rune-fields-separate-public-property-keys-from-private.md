---
id: 01a1955f-e81c-7f33-a580-59907586dc15
title: Class rune fields separate public property keys from private storage names
ord: 4
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/compiler/analysis/classes.ts
  - kind: file
    ref: packages/vigla/src/compiler/client/classes.ts
  - kind: file
    ref: packages/vigla/src/compiler/server/classes.ts
  - kind: symbol
    ref: packages/vigla/src/compiler/client/script.ts
    symbol: assignField
  - kind: symbol
    ref: packages/vigla/src/compiler/server/script.ts
    symbol: rewrite
---
A literal property key need not be a valid identifier. Analysis keeps its JavaScript property-name identity while allocating valid, collision-free private backing names, shared by declaration and constructor rewrites. Replacing a computed constructor target with a private member also removes its computed access. An empty public declaration for a constructor-derived field must disappear on both targets; otherwise the instance property shadows the generated getter.