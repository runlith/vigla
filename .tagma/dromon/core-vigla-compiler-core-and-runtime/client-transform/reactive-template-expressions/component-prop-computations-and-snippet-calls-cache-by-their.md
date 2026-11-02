---
id: 01a1954e-42f5-74e8-a72b-e17de7b9ba39
title: Component prop computations and snippet calls cache by their own dependencies
ord: 2
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/compiler/client/component.ts
    symbol: memoValue
  - kind: symbol
    ref: packages/vigla/src/compiler/client/component.ts
    symbol: propsObject
  - kind: symbol
    ref: packages/vigla/src/compiler/client/component.ts
    symbol: renderCall
---
A child may read a prop or snippet argument several times without changing its source dependencies, so calls are cached at the invocation rather than repeated by live getters. Component comparisons and other non-simple reactive values also cache their result: unchanged equality must not wake a child's effects merely because an input changed. Bindings retain direct read/write access; plain identifier and member inputs remain live getters without an extra derived.