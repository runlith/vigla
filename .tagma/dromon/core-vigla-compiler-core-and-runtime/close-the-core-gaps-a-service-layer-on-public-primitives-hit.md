---
id: 01a19ddb-860e-7528-9438-29001913a14f
title: Close the core gaps a service layer on public primitives hits
ord: 16
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a18776-8e37-7bdc-93a5-7dad4786b347
---
A probe of ten stacked service layers built only on `vigla`'s public entry (scratch `layers-probe/probe.ts` of the lead thread) confirmed context through ten nested owners, cascading disposal, a reactive chain across ten layers and `Owner.start` work in `settled()`, and found three gaps that force an abstraction on top into internals or wrong behaviour:

- No public memoized derived: `derived` exists in the reactivity core but only `vigla/internal/client` exports it, so a TypeScript library cannot memoize without the compiler or an internal import.
- No owner-level failure handling: an effect throwing under a service root escapes the flush (`fail` with no boundary rethrows); error containment exists only as the DOM's `Boundary`.
- Sibling owners release in creation order (measured `s0…s9`), so a service created after its dependency is torn down after it; dependents must release first.

Also from reading: on the client `getAbortSignal()` inside `owner.run` throws because no reaction evaluates there, so an owner has no lifetime signal; context set on an owner after a child owner was created does not reach that child, because the child captured the parent's earlier layer.

Each fix belongs in the core as a general primitive, with Svelte-pinned component behaviour (component teardown order, boundaries) kept unchanged in the adapter where upstream tests pin it.