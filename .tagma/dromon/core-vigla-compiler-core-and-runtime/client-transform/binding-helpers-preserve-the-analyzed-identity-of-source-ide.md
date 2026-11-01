---
id: 01a19483-fa30-7727-88c1-697549f12432
title: Binding helpers preserve the analyzed identity of source identifiers
ord: 13
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/compiler/client/bindings.ts
---
Binding rewrites resolve reads through the original identifier objects; cloning an each parameter before rewriting loses that association and passes its signal cell instead of its value. Checkbox groups using an identifier key by the resolved binding, so separate source occurrences share a group while shadowed bindings remain separate.