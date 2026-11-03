---
id: 01a19e46-1155-797e-a839-59a627516cba
title: A server render's component teardowns end with its owner, deepest first in its retained output's order
ord: 8
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a19421-1645-7dc0-92eb-35c8acbd7905
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/owners.ts
    symbol: onDestroy
  - kind: symbol
    ref: packages/vigla/src/runtime/server/context.ts
    symbol: push
  - kind: symbol
    ref: packages/vigla/src/runtime/server/context.ts
    symbol: release
  - kind: symbol
    ref: packages/vigla/src/runtime/server/render.ts
    symbol: render
---
Each server component instance is a context layer placed into the output where the component begins, so a component that renders after an `await` sorts where its markup stands, not when it ran. Release walks those placements and runs each instance's `onDestroy` callbacks after its descendants', siblings in document order (`async-ondestroy-ordering`); callbacks registered outside any component run last with the render's own layer.

Release is a teardown of the render's owner: it runs when the render settles, when it fails, or when an ancestor such as a request owner is disposed mid-render. The render owner is an application scope, so it releases before services created under the same parent before it.

Instances whose placements a boundary recovery or a binding retry discarded release first, newest first, since no retained output orders them any more: their callbacks carry `external` and `$store` subscriptions, which would otherwise outlive the request. A callback registered after the owner ended, by a continuation still rendering after disposal, runs at once. Every component callback runs even when one of them, or the teardown of an owner created under the render, throws: a render ending on its own releases its instances itself when destruction stopped at such an error. The first error then propagates, out of `render()` or through the disposing owner's failure path, unless the render itself failed, whose error wins.
