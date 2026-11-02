---
id: 01a19e89-ba84-74e6-83c0-2dfd57bf29e6
title: A compiled server resume ends before its function suspends again
ord: 9
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a19421-1645-7dc0-92eb-35c8acbd7905
sources:
  - kind: file
    ref: packages/vigla/src/runtime/server/context.ts
  - kind: file
    ref: packages/vigla/src/compiler/server/script.ts
---
A server render's globals — the render, its output site and the synchronous owner — belong to the whole realm, and the continuations of concurrent requests interleave on one microtask queue. If a resumed segment is still open when its function returns to the queue, the next continuation to run inherits those globals: another request's code then reads this render's owner, context and request store. The runtime once cleared the globals in a later microtask, which left exactly that window.

Each compiled async server function holds a segment token. That covers expression thunks, async children, async titles and async instance scripts.
- `save(value, segment)` captures the state, ends the function's open segment and suspends.
- The restore that `save` returns opens the segment again.
- `unsave(segment)` in a `finally` ends it when the function returns or throws.

The token belongs to one call of the function. A thunk called synchronously inside another function's resumed segment must not end its caller's segment when it first suspends.

Once a function resumes anywhere, every `await` in it goes through `save`, the last one included, even though restoring after the last one gains nothing. A plain `await` after a resume would suspend with the segment open. Nested functions are not segmented, and their awaits stay plain. A `$derived(await …)` evaluates in an async thunk of its own; the enclosing function's segment is restored after it only when that function has a segment.

A top-level `for await` cannot route its implicit awaits through `save`. `acquire` takes the iterator while the segment is open. It wraps the iterator's `next` and `return` so that each call runs inside the segment, which closes again before the loop awaits the result. The loop's binding moves into the body, after the body `reenter`s, so destructuring defaults also read the render's context. Labels stay on the loop itself, so `continue` keeps a valid target. An `await using` declaration is refused in an async script, because its disposal awaits at block exit, where no `finally` of the function can close the segment first.

Ending a segment restores the state that opening it replaced, so segments nest strictly. Any suspension with an open segment breaks that order and leaks stale state into every later close.

Runtime continuations that resume a captured render use `capture()`'s `resume(fn)`, which restores, runs and ends synchronously. These are a stabilizing pass after its async children settle, and a boundary's recovery. `resume` leaves the render's component layer pointer where it set it. A boundary recovering synchronously depends on that: it puts back the layer stack its failed children left pushed.
