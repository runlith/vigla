---
id: 01a19ce4-390c-7e6b-a78c-e327e61b70c4
title: Remote form input invalidation follows the changed field
ord: 18
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/kit/src/client/remote/form.ts
    symbol: Form
---
A field edit leaves sibling projections unchanged because reapplying an untouched control's undefined value can erase its browser-owned selection. Whole-form replacement and reset may invalidate the input tree; `fields.value()` returns detached snapshots so later reactive writes cannot alter a captured submission value.