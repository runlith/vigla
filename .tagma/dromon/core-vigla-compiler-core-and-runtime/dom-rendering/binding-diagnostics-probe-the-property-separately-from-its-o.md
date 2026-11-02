---
id: 01a19c3f-c63d-7270-abb9-afc5da04bfda
title: Binding diagnostics probe the property separately from its object and key
ord: 31
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a18680-7dbd-7ae0-84ae-0bacb1135202
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/bindings.ts
    symbol: validateBinding
---
A reactive object reference or computed key does not make its final property reactive, so development binding validation isolates that property read from its selectors. Selector changes recheck the property until the binding has warned once; property updates do not repeat its diagnostic read. Externally mutable bindings retain their producer's notification contract through forwarded props and external-backed list scopes, where a plain property need not have its own reactive source.