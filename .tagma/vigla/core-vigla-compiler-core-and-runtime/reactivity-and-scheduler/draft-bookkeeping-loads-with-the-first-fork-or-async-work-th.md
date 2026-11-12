---
id: 01a1d18b-033c-7d4d-a712-ac1ed57f7cb7
title: Draft bookkeeping loads with the first fork or async work; the effect tree reaches it only through `drafter`
ord: 59
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a19eeb-6938-7e83-802a-648f389a8e9e
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/drafting.ts
    symbol: useDrafts
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: drafter
---
An application that never forks and never awaits runs no reaction under a fork or an async view, so the draft lifecycle — beginning, promoting, installing and dropping drafts, and setting a derived's effects aside under a view — is code its bundle would carry for nothing. `effects.ts`, `reads.ts`, `scheduler.ts`, `settle.ts` and `sources.ts` therefore call it through the `drafter` hooks, which `useDrafts` in `drafting.ts` sets from `fork()`, `work()` and `asyncDerived()`. Each place that calls a hook stands behind a condition only those entry points can make true: a nonzero `drafting` count, a fork batch, an async effect, or a view, which exists only beside a held batch or a fork. A new way to start a draft or a view must call `useDrafts` first; a direct import of the draft lifecycle from those files puts it back into every bundle.