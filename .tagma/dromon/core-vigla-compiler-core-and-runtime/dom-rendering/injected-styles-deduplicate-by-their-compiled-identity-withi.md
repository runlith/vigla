---
id: 01a187a8-0798-7278-9174-f531ff326bcd
title: Injected styles deduplicate by their compiled identity within a document, shadow root or server render
ord: 4
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/styles.ts
  - kind: file
    ref: packages/vigla/src/runtime/server/render.ts
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/range.ts
    symbol: position
  - kind: file
    ref: packages/vigla/src/entries/compiler.ts
  - kind: file
    ref: packages/svelte/src/compiler/index.ts
---
The injected sheet's identity must agree between client and server so hydration reuses the server style. It defaults to the scoping class, and an explicit `cssHash` retains deliberate sheet sharing. The compiler caller may supply a separate CSS id: the adapter does this for anonymous components without `cssHash`, deriving it from the complete component source while leaving the authored-CSS-based class unchanged. Equal authored sheets can prune differently in different templates, so their class alone cannot identify the emitted sheet. Styles deduplicate within their document or shadow root and within each server render.

The client inserts from an effect after the owning range reaches its final tree. It resolves the range's stable start node because the original render anchor can already have been removed; using that detached anchor or an off-screen fragment would send a shadow component's sheet to the document.