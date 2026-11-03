---
id: 01a19566-7dac-7d9e-801d-93e80f067890
title: A nullable server pending attribute selects children when no snippet is supplied
ord: 2
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/compiler/server/component.ts
    symbol: boundary
---
The presence of a pending attribute does not guarantee a snippet value. Server generation evaluates that value once and chooses either pending markup or the boundary's children; a declared pending snippet is already known to exist. Reusing the evaluated value keeps observable getters and calls from running twice while deciding and invoking the handler.