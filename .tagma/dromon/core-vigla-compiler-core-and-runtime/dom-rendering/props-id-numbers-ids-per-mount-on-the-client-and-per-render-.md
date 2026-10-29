---
id: 01a187ae-6d0d-7d16-bd1e-acb4d5c2997d
title: "`$props.id()` numbers ids per mount on the client and per `render()` call on the server, keeping nothing on `window`"
ord: 5
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fac9d5e3831
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/props.ts
  - kind: file
    ref: packages/vigla/src/runtime/server/render.ts
---
The counter lives with the tree that asks for an id: on the client it is keyed in a `WeakMap` by the top-level root effect of the caller's owner chain — the mount, whose root effect has no parent — and on the server it is the counter of the `render()` call. An unmounted tree takes its count with it, so nothing outlives it on `window` or in the module and a target resets nothing between mounts (invariant 5 of [[9d5e3831]]).

While hydrating, the id is read from the `<!--$id-->` comment the server wrote where the component's script asked for it, so a hydrated component keeps the server's `s<n>` (prefixed by `idPrefix`); a component created after hydration counts `c1`, `c2`, … from its mount's own start, as upstream's `props-id` samples pin. The id text keeps upstream's shape.

The trade: two separate mounts in one document can both issue `c1`. Upstream shares one counter across mounts and runtimes through `window.__svelte.uid`; Vigla rejects it because that counter is runtime state outliving its trees and puts a front end's name into the core's global.
