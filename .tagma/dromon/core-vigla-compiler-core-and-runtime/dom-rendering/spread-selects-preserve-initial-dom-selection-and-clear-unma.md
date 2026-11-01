---
id: 01a19542-2042-7a59-be1a-137dfa1be013
title: Spread selects preserve initial DOM selection and clear unmatched later values
ord: 24
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/select.ts
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/attributes.ts
    symbol: attributes
  - kind: symbol
    ref: packages/vigla/src/compiler/client/element.ts
    symbol: spread
---
Select options can publish non-string values after the element's spread first runs, so initial selection waits until option setup completes and an initially undefined value preserves the DOM default. Later spread updates use ordinary selection semantics: an unmatched value, including undefined on a single select, clears selection. The stored value remains available to the option mutation observer; bind:value owns its own initialization instead of adding a second spread initializer.