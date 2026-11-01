---
id: 01a19578-1981-77f9-8f13-4cce5fd60710
title: Select defaults and live selection have separate lifetimes
ord: 26
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/select.ts
    symbol: selectDefault
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/select.ts
    symbol: applyDefault
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/select.ts
    symbol: initSelect
---
Changing a default changes the form-reset choice without moving the user's current selection. Spread defaults wait for option setup, and one observer keeps defaults and controlled values aligned when options arrive later; setting an already-correct selected attribute again can make the browser undo a user selection.