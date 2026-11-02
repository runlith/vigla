---
id: 01a1877e-fd98-7ad3-8502-952177d1c74f
title: "An owner is a root effect: what is created under it dies with it, never with the caller"
ord: 4
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a18776-8e37-7bdc-93a5-7dae8191e72f
sources:
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/owners.ts
---
An `Owner` is the public handle of a root effect, so a lifetime an application has — a request, a tab, a session, a service — is the same object the scheduler traverses: what `root(fn, parent)` creates runs in a root linked under `parent` and is destroyed with it, its teardowns running, and with no parent it is a top-level root ordered among the others by creation. The caller's reactive context never adopts it: the root is not linked under the effect or branch that created it, so that branch's teardown or rerun leaves it standing. This is what upstream reaches with `without_reactive_context` around `$effect.root`, which runlith's patch had to export. `$effect.root` itself is such a root without a parent, keeping the caller's context and boundary.

Because an owner is an effect, its effects and async work go through the same batches, views and `settled()` as a component's, and everything set on `Effect.context` is inherited down it. `owner.run(fn)` makes it the owner of what `fn` creates synchronously, without the caller's reactive reading or creation scope, so service state cannot become local state of a calling derived. A continuation after an `await` runs under it again only through another `run` or the scheduler's `suspend`. `owner.start(fn)` additionally registers the callback as async work: its result or rejection reaches the returned promise, and its scheduler unit settles when the callback completes or its owner is disposed, so services participate in `settled()` without a component or an internal runtime import. The handle is created on first request and kept in a `WeakMap` keyed by the effect, so the runtime holds no registry of owners and a disposed tree leaves nothing behind (invariant 5).

On the server, effects never run: `effect` is a no-op and `cell` a plain object there, while `root` and `getOwner` are the same owners. Every `render()` creates an owner of its own under the caller's current owner and disposes it when the render ends, so a request's lifetime is a `root()` the application renders under, and what was set on it reaches the render.
