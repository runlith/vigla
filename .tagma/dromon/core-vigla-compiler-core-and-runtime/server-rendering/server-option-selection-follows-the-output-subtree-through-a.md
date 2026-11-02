---
id: 01a19556-8eda-72c4-9cd1-8d9effc8d6b7
title: Server option selection follows the output subtree through asynchronous descendants
ord: 6
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/compiler/server/asynchronous.ts
    symbol: asyncChild
  - kind: symbol
    ref: packages/vigla/src/compiler/server/template.ts
    symbol: formElement
  - kind: symbol
    ref: packages/vigla/src/runtime/server/render.ts
    symbol: Output
---
A select's value and multiple flag belong to its child output, so components, boundaries and asynchronous descendants retain the same selection while sibling selects and concurrent renders remain independent. An option with no explicit value uses its single expression's original type, or its rendered body after asynchronous work settles; hydration wrappers introduced for asynchronous fragments are excluded from that body without removing them from the emitted HTML.