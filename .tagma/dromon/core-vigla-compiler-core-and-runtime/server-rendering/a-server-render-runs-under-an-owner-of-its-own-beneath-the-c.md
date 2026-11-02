---
id: 01a19421-1645-7dc0-92eb-35c8acbd7905
title: A server render runs under an owner of its own beneath the caller's, and reads context and hydratable data through owners
ord: 4
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a18776-8e37-7bdc-93a5-7dae8191e72f
  - kind: relates
    to: 01a1877e-fd98-7ad3-8502-952177d1c74f
sources:
  - kind: file
    ref: packages/vigla/src/runtime/server/context.ts
  - kind: file
    ref: packages/vigla/src/runtime/server/render.ts
  - kind: file
    ref: packages/vigla/src/runtime/server/hydration.ts
---
`render()` creates a root owner under the owner current at the call — a request's, when an application renders inside `owner.run` — makes it the owner of the synchronous render and of every continuation `save` restores, and disposes it when the render ends: at once for a synchronous render, after settlement for an asynchronous one, on a thrown error too. Disposal is the render's lifetime: `getAbortSignal()` during a render answers that owner's signal, aborted with the stale-reaction reason when it is disposed, and roots created under it during the render die with it. `onDestroy` keeps its own timing, at the end of the synchronous pass.

Context inherits the request owner's layers unless `render` receives an explicit context map, which starts a separate chain. A component uses the render's layer stack, while code selecting another owner during the render uses that owner's layers; otherwise a service could overwrite a component's context or read values it never inherited. A render keeps its component layers separately because server components create no owner each. Compiled async expressions restore their layer before continuing evaluation, including title expressions. After suspension the layer reports a running phase to the adapter, which rejects late `setContext`; Core context operations remain usable under owners without that component-only restriction.

The hydratable store follows the same chain: `openHydration()` opens one on the current owner, `hydratable` outside a render registers into the nearest opened store, and a render under that owner writes the same store's script into its `head` instead of a store of its own. That is how values registered before rendering — in hooks or loads — reach the page; a store is never closed on the server, it goes with its owner. Its optional `beforeSnapshot` callback runs under that owner after the render's asynchronous work settles and before serialization, including when it supplies the store's first value. A store can serve another render after a failure, so its publisher must tolerate repeated calls without publishing a different value under an existing key.