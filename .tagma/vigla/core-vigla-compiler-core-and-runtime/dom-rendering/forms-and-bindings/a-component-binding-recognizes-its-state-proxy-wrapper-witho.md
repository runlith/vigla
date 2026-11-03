---
id: 01a1947c-aacf-7786-a2d3-2507075834b6
title: A component binding recognizes its state-proxy wrapper without clearing a replacement
ord: 1
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/bindings.ts
    symbol: bindThis
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/bindings.ts
    symbol: matches
---
Writing a component export object into state may wrap it in a proxy. Binding identity includes that wrapper, so teardown can clear its own reference without erasing a newer instance's binding.