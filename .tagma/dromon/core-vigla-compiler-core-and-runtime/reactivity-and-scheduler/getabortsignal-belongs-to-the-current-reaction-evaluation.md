---
id: 01a19414-dc8b-7c9b-a436-73ada23b5169
title: getAbortSignal belongs to the current reaction evaluation
ord: 12
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/abort.ts
---
Repeated calls during one evaluation return one signal, including calls through `untrack`: disabling dependency collection preserves execution identity. Explicit root callbacks and teardown callbacks clear that identity. Its controller is released through the same teardown tree as the reaction's other resources, so a rerun, disconnection or destruction aborts it with `StaleReactionError` before replacement work starts; a derived's own signal is also aborted when its last reader leaves, and the derived then evaluates again on its next read rather than handing a returning reader work it already cancelled. The handle is weakly keyed by the real tracking reaction, including production builds; native service roots use the same effect and derived lifetimes as components, and a call outside a reaction is a typed runtime failure.