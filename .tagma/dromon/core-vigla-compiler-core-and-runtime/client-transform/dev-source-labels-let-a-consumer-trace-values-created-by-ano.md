---
id: 01a193d2-50fe-77d8-949b-840292f7f32c
title: Dev source labels let a consumer trace values created by another module
ord: 9
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a193c4-e7ae-7f38-8d9f-ed92226fbb20
sources:
  - kind: file
    ref: packages/vigla/src/compiler/client/classes.ts
  - kind: file
    ref: packages/vigla/src/compiler/client/inspect.ts
  - kind: file
    ref: packages/vigla/src/compiler/client/patterns.ts
---
State and derived declarations receive DEV labels independently of whether their own module traces them, because a consumer may trace an imported value. A module containing `$inspect.trace` enables write-stack collection, and the traced body runs in a lexical thunk that preserves its return, `this` and `arguments`. Function-scoped `var` bindings stay in the original function, with their initializers left in the thunk, so a redeclaration still shares a parameter's binding. Production generation omits labels and trace instrumentation.