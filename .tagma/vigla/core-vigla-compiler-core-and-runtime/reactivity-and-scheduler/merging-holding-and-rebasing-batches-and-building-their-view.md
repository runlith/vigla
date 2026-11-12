---
id: 01a1d18e-b46f-76f6-bd51-b4e6fd7a6358
title: Merging, holding and rebasing batches and building their views load with the first fork or async work
ord: 60
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1868a-e2b1-75a8-92fb-02edaa9fb09b
  - kind: relates
    to: 01a1d18b-033c-7d4d-a712-ac1ed57f7cb7
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/holding.ts
    symbol: useHolding
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/views.ts
    symbol: holding
---
Several uncommitted batches exist only after a fork or after async work holds a batch, so an application without either never merges a batch into an earlier held one, never holds one, never rebases others on a commit and never reads through another batch's view. That code lives in `holding.ts`, and the scheduler, `finish` and `reads.ts` reach it through the `holding` hooks in `views.ts`, which `useHolding` sets from `fork()`, `work()` and `asyncDerived()`. Each call stands behind a condition only those entry points make true: a non-empty `pending` list, a batch that `holds`, or a view, which `others` asks for only beside a held batch, a fork or a batch with its own values. What every application can still need stays in `held.ts`: folding a failed batch into the open one, ending, discarding and abandoning a batch. A new way to leave a second batch uncommitted must call `useHolding` first.