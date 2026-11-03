---
id: 01a19c24-e0a3-7a44-8571-f802a45e2746
title: Ordinary component bindings override prop spreads on both targets
ord: 3
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/compiler/client/component.ts
    symbol: propsObject
  - kind: symbol
    ref: packages/vigla/src/compiler/server/component.ts
    symbol: propsObject
---
An ordinary component binding owns its prop connection regardless of where surrounding spreads were authored; letting a later spread replace it loses both the bound value and its writeback destination. Client and server therefore keep those binding accessors authoritative while retaining the order of other attributes and spreads. Client mutability and forwarding metadata stays attached to the selected binding envelope. Function bindings remain source-ordered, matching the upstream distinction.