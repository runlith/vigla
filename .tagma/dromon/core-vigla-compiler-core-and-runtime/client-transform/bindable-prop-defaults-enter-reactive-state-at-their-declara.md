---
id: 01a19c1f-888a-7934-9855-4c7c3e998c62
title: Bindable prop defaults enter reactive state at their declaration
ord: 20
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/compiler/client/script.ts
    symbol: propDeclarators
---
A default created for a bindable prop is the child's mutable state; an ordinary prop default stays raw. Proxying belongs to declaration lowering so the prop runtime does not pull proxy machinery into components whose defaults need none. Lazy fallback evaluation retains that ownership and creates the proxy only when the default is needed.