---
id: 01a1877e-fd98-7ad3-8502-952177d1c74f
title: Owners expose the effect tree's lifetimes to applications
ord: 4
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a18776-8e37-7bdc-93a5-7dae8191e72f
sources:
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/owners.ts
---
`root(fn, parent)` creates an application lifetime in the scheduler's effect tree, linked only to its explicit parent; a calling reaction never adopts it. Its marked child application roots release newest first, before the remaining children, so dependents created after their dependencies release first. Component instance roots and ordinary effect siblings keep creation-order teardown. `getOwner()` also exposes an existing current effect's lifetime, so a handle obtained lazily cannot change what it owns.

A local context layer is materialized only for a handle or a context write, keeping ordinary effect creation and context lookup on their inherited layer pointers. Materializing it retargets existing descendants still sharing the old inherited layer; a child's own layer keeps its values and receives only the new parent link. Traversal stops at local or separately captured layers, and isolated server renders retain their context boundary. Late handles and late ancestor writes therefore reach existing children without allocating a context layer for each branch or row. A server render materializes its handle before pushing component layers; child owners capture the active render stack rather than whatever component layer happens to be current later.

`owner.run` suspends the caller's dependency-reading and state-creation scopes. `owner.start` additionally counts work in `settled()` until completion or disposal, while returning the callback's result or rejection. Ordinary JavaScript continuations re-enter explicitly through `owner.run` after an await. The owner's lifetime signal aborts on disposal; cancellation of the underlying operation is cooperative through that signal. Handles and failure registrations are weakly keyed by their effects, without a runtime registry retaining finished application scopes. Server effects do not run, but owners, context and lifetime disposal remain available around rendering.
