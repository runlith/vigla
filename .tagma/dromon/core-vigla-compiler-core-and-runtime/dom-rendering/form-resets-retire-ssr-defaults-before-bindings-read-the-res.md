---
id: 01a19578-1752-7f66-94e4-36508e03bce0
title: Form resets retire SSR defaults before bindings read the reset value
ord: 25
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/reset.ts
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/attributes.ts
    symbol: removeInputDefaults
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/bindings.ts
    symbol: listenWithReset
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/select.ts
    symbol: bindSelect
---
A server value or checked attribute is a temporary default, not the default a live binding should read after reset. Cleanup and reset callbacks share a document-local, flushable queue so their registration order remains consistent even when reset precedes normal cleanup; binding registrations end with their owner.