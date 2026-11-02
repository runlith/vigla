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
`render()` creates a root owner under the owner current at the call — a request's, when an application renders inside `owner.run` — makes it the owner of the synchronous render and of every continuation `save` restores, and disposes it when the render ends: at once for a synchronous render, after settlement for an asynchronous one, on a thrown error too. Disposal is the render's lifetime: its abort signal ends with the stale-reaction reason, and roots linked under it die with it. Selecting a separate owner inside a render keeps that owner's abort signal and teardown registrations with its own lifetime. Component `onDestroy` callbacks are teardowns of the render's owner ([[27516cba]]).

Core renders inherit the caller owner's context, with an explicit context map layered above it. The render materializes its owner handle before pushing those component layers, so a later `getOwner` cannot insert a non-component layer above the active component and hide its initialisation phase. `inheritContext: false` starts an independent context chain while keeping the same lifetime parent and hydration store; the adapter selects this by default because upstream renders do not inherit the caller component's context. A component uses the render's layer stack, while code selecting another owner during the render uses that owner's layers; otherwise a service could overwrite a component's context or read values it never inherited. The render owner carries the selected layer, so child owners inherit the component and explicit-map context active when they are created; server components still create no owner each. Compiled async expressions restore their layer before continuing evaluation, including title expressions. After suspension the layer reports a running phase to the adapter, which rejects late `setContext`; Core context operations remain usable under owners without that component-only restriction.

The hydratable store follows the same chain: `openHydration()` opens one on the current owner, `hydratable` registers into the nearest store on the current owner's chain, and a render under that owner writes the same store's script into its `head` instead of a store of its own. A render keeps its store on its own owner and serializes whichever store stands there when it settles, so `openHydration()` called during the render replaces the store of that page, and code selecting another application's owner during a render registers into that owner's chain, never into the page being rendered. That is how values registered before rendering — in hooks or loads — reach the page; a store is never closed on the server, it goes with its owner. Its optional `beforeSnapshot` callback runs under that owner after the render's asynchronous work settles and before serialization, including when it supplies the store's first value. A store can serve another render after a failure, so its publisher must tolerate repeated calls without publishing a different value under an existing key.