---
id: 01a19c92-002b-7a7c-8029-aa56654ac739
title: Undefined server bindings publish the child's final value before parent output is retained
ord: 3
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/compiler/server/component.ts
    symbol: bindingProperties
  - kind: symbol
    ref: packages/vigla/src/compiler/server/index.ts
    symbol: server
  - kind: symbol
    ref: packages/vigla/src/runtime/server/render.ts
    symbol: bindProps
  - kind: symbol
    ref: packages/vigla/src/runtime/server/render.ts
    symbol: Output.stabilize
  - kind: symbol
    ref: packages/vigla/src/runtime/server/render.ts
    symbol: Settlement
---
A bound child can supply the value that text before its invocation already read, so publishing a fallback alone leaves inconsistent markup. Publication waits for the child's template and asynchronous descendants, uses an existing parent setter only while its value is undefined, and excludes ordinary prop defaults. An ordinary binding write invalidates its lexical component's template pass, even when a wrapper invokes its children or snippet into another output. Root snippet declarations retain instance-script scope; retrying the template does not repeat that script. Discarded passes lose their body and head together. Retries restore their captured render context, keeping overlapping requests independent. Function bindings retain their source-ordered invocation without requesting a template retry.