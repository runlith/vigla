---
id: 01a19c1f-888a-7934-9855-4c7c3e998c62
title: Bindable prop defaults enter reactive state at their declaration
ord: 5
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/compiler/client/script.ts
    symbol: propDeclarators
---
A default created for a bindable prop is the child's mutable state; an ordinary prop default stays raw. The lowering owns this distinction, avoiding an unconditional dependency from the prop runtime to proxy machinery. Lazy fallback evaluation retains that ownership and creates the proxy only when the default is needed.