---
id: 01a19402-35db-7fb2-9239-b4df16708ab4
title: A forwarded bindable value keeps the mutability of its source
ord: 2
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/props.ts
    symbol: prop
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/props.ts
    symbol: mutableProps
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/props.ts
    symbol: forwardProps
---
An externally supplied plain object can change without becoming a proxy, so a nested mutation must reach its producer even after a component forwards the binding. Mutability follows getter and accessor identities through weak metadata, including the getter a props spread actually selects; forwarding an ordinary reactive value therefore does not add setter calls for mutations its proxy already publishes.