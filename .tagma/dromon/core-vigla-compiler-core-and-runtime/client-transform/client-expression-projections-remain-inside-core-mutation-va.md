---
id: 01a19db0-045d-7a09-a778-1354bc8cf94d
title: Client expression projections remain inside Core mutation validation
ord: 26
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/svelte/src/compiler/proxy.ts
  - kind: file
    ref: packages/svelte/src/entries/proxy.ts
  - kind: file
    ref: packages/vigla/src/compiler/client/script.ts
  - kind: file
    ref: packages/vigla/src/compiler/ir/runtime.ts
  - kind: file
    ref: packages/vigla/src/entries/compiler.ts
  - kind: file
    ref: packages/vigla/src/shared/assignment.ts
---
Adapters project ordinary calls and member assignments after child lowering to keep front-end DEV policy outside the core. The callback carries the original expression identity, the lowered operation and the allocated runtime identifier, so adapters can select authored expressions without treating generated binding updates as source code. Component and module clients share the projection; server and non-DEV output omit it. Core prop-mutation validation wraps the projected operation, and projections preserve single evaluation and source locations. Assignment projections use the shared native lvalue so logical RHS evaluation and yield/await suspension stay in the caller's scope. Its notification receives the raw assigned value only after a successful write; the adapter compares that value using the last actual converted key without another user coercion.