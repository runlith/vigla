---
id: 01a193f4-dfa5-7f9e-8a3b-1dc75f03f073
title: External emissions use source equality and live under the declaration owner
ord: 10
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/external.ts
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/graph.ts
    symbol: Source
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/sources.ts
    symbol: mutableSource
---
An external value retains one subscription after its first read, independent of which reaction last read it. A read or `refresh` reevaluates its selector and releases a changed source; disposing its owner releases it immediately. Reads after disposal subscribe only long enough to obtain the current value. Emissions enter the same value graph and batch views as native state, with an equality policy that treats objects and functions as mutable; ordinary sources and deriveds retain `Object.is` unless they declare another policy. A producer may offer `subscribeSync` for immediate value propagation alongside queued user notifications; the connection selects it so reentrant reads do not wait for that queue. A collection expression that directly reads an external value carries that policy into its row sources so an in-place mutation does not disappear behind stable object identity.