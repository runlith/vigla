---
id: 01a193d2-5094-713e-b2f1-f94c4d84bab4
title: Dev metadata parents follow owned rendering scopes
ord: 12
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/compiler/client/meta.ts
  - kind: file
    ref: packages/vigla/src/runtime/dom/meta.ts
---
A structural block, component invocation or snippet render keeps its source frame on a child owner, so branches created later and async continuations recover the same parent chain without a process-wide metadata stack. Elements carry their source location and that chain under the key supplied by the compile format. This adds an owner per marked rendering scope only in development; the weak frame table cannot retain an unmounted tree.