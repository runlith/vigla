---
id: 01a19431-bfe2-7927-a896-026c18978c18
title: Server derived values cache for their declaration's lifetime while what they read is unchanged
ord: 5
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/server/context.ts
    symbol: isRendering
  - kind: symbol
    ref: packages/vigla/src/runtime/server/derived.ts
    symbol: derived
  - kind: file
    ref: packages/vigla/src/runtime/server/cells.ts
---
A module's compiled derived can outlive many requests, so it re-evaluates on each read rather than retaining the first request's value. Created during rendering, it keeps a lazy cache for that instance. Its compiled assignment protocol uses a non-nullish override; a nullish assignment clears that override.

The public `derived` instead follows its declaration owner, the ambient one at the call, which may be a service or a request outside rendering. It evaluates lazily under that owner and the layer it captured at declaration. It keeps its result only while what it read is unchanged. Server cells, deriveds and externals carry a version. A derived records the version of each one it read and re-evaluates when any of them moved, just as the client recomputes when a dependency changes. Its `equals` keeps an equal result from moving its own version, and an assignment holds until a dependency changes. Reads made where the client stops tracking are not recorded either: inside `untrack`, `owner.run`, a root's function or an external's `peek`. The server collector is suspended at the same boundary. Mutating a plain value in place moves no version: on the server, `state` keeps plain values. A failed evaluation goes to the owner's handler first, unless the owner is disposed, and is kept as the client's public derived keeps it ([[6c6e56a2]]): every read rethrows it until a dependency changes or an assignment publishes. Failing and recovering both move the version even when the value compares equal, so a derived that read the failure re-evaluates.

The declaration layer matters because server components share a render owner. A child that first reads its parent's memo must not capture the child's context, and a child's exported memo keeps its context after the component has returned. An unowned declaration evaluates on every read under the reader's current scope, because its result may depend on a request's context. Its assignable `current` accepts nullish overrides too, matching the public client value rather than the compiler's callable protocol. Server owners supply cancellation and failure routing without making server effects run.
