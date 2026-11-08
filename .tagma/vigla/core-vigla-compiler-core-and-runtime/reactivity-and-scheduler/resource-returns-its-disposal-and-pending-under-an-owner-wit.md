---
id: 01a1b93f-3d4c-7d83-bb93-77305c3a1a39
title: "`resource` returns its disposal, and `pending()` under an owner with no boundary has a tested answer"
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
**Outcome.** `resource` returns the disposal `effect` and `external` already return, and `pending()` called under an owner with no boundary has a stated, tested answer.

**What stands.** `resource(fn)` resolves to `{ current }` only (`runtime/reactivity/public.ts`) and ends only with its owner. `pending()` under an owner with no boundary answers 0 (`runtime/reactivity/async.ts`); nothing states or tests it.

**Not here.** A failure, an in-flight flag and `refresh()` on the resource. `@runlith/query` takes status, failure and refetch from TanStack through `external`, and a screen waits for a key's data through compiled `await` of the query's promise, so no named consumer needs them. Whether a screen keeps the previous key's data until the next arrives is the consuming product's decision, not the core's.

**Design to settle.**
- Shape: a dispose function returned beside the cell, or `dispose()` on it — matching `external`.
- `pending()` with no boundary: whether 0 is right, or the owner's own count of pending units.

**Acceptance.** Public-contract tests in `packages/vigla`: disposing a resource stops its reruns and settles its pending unit; `pending()` under an owner with no boundary answers what this spec settles. Explanation [[6077256f]] states the new return.
