---
id: 01a19c25-ab5e-7184-a3af-2102c7302fc3
title: Event expressions cache calls while diagnostics retain the expression's source
ord: 3
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/compiler/client/events.ts
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/events.ts
    symbol: invoke
---
A handler factory must rerun when its dependencies change, rather than on every event; compiling expressions containing calls into a derived also preserves mutation guards while resolving the handler. Development invocation evaluates the handler thunk before warning, so a failed prop read reports the consuming event expression's location and then rethrows the original failure. Plain nullish handlers stay silent unless their expression has side effects.