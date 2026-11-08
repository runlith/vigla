---
id: 01a1b93f-3d4c-7d83-bb93-77305c3a1a39
title: "`resource` carries its own failure, in-flight state, refresh and disposal"
ord: 57
tags: ["spec"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a19de0-59b2-7950-bf1d-a0b137f29ce1
  - kind: relates
    to: 01a19e73-9448-7fa1-ba9a-8d536077256f
---
**Outcome.** A library built on the public `resource` needs nothing else to manage one async value: the resource exposes its current value, the failure of its last run, whether a run is in flight, a way to rerun it without a dependency change, and its own disposal.

**What stands.** `Resource<T>` exposes only `current` ([[6077256f]]).
- A failure after the first value reaches the boundary of its owning batch; outside components there is none, so the owner's handler gets it and the resource keeps no failure of its own.
- `pending()` reads the nearest boundary's count; what it answers under an owner with no boundary is not established.
- A run repeats only when something it read changes, so a cache invalidating an entry has to fake a dependency.
- Disposal goes only through the owner.
- No package uses `resource` yet; the `resource` of Kit's remote functions is Kit's own and unrelated.

**Design to settle.**
- `error`: the last run's failure, cleared by the next success; whether it also reaches the owner's handler.
- A reactive "run in flight" flag that holds nothing.
- `refresh()`: reruns in a new batch; whether that batch holds the screen is the caller's choice through `hold`, never the resource's.
- `dispose()`: ends this resource before its owner and settles its pending unit.
- The first run keeps holding nothing unless the caller wraps it in `hold`.
- The shape is settled against the first real consumer, `@runlith/query`'s Vigla binding: a key change holds the batch through `resource`, while background refetch and status flow through `external` without holding.

**Acceptance.**
- Public-contract tests in `packages/vigla`: a failure is kept and cleared; the in-flight flag is true during a rerun and false after; `refresh()` reruns with no dependency change; `dispose()` stops reruns and settles its unit; `pending()` under an owner with no boundary has a defined, tested answer.
- `@runlith/query`'s Vigla binding builds on it with no internal import.
