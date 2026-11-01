---
id: 01a195aa-0030-70f5-a5ff-025ba5b0a62d
title: Focused controls keep browser edits when an older held edit commits
ord: 6
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/bindings.ts
    symbol: BindingEdits
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/bindings.ts
    symbol: markEdits
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/bindings.ts
    symbol: bindValue
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/select.ts
    symbol: bindSelect
---
A control already displays the user's latest value while a held batch may still read an older one. Binding rewrites suppress only batches that originated in that control, following merge aliases; unrelated programmatic writes remain visible. Weak batch membership and metadata-only transfers avoid retaining the control or completed batches.