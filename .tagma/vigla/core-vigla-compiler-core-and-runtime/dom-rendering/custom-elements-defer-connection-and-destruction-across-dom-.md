---
id: 01a19460-3937-7a1d-9642-3bb365ac73e0
title: Custom elements defer connection and destruction across DOM moves
ord: 19
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/custom-element.ts
---
Connection waits one microtask so the host's light-DOM children exist when slot availability is captured. Disconnection waits likewise: moving an element within the document preserves its mounted owner and state, while a detached element releases its component, delegated events and reflection effect.