---
id: 01a19421-1792-7d85-983b-7a382bee15d8
title: A mount stands under the current owner, and openHydration lets an owner read the page's hydration data outside hydrate()
ord: 18
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a18776-8e37-7bdc-93a5-7dae8191e72f
  - kind: relates
    to: 01a19411-bd0e-7d82-8c1c-d1003fa6b706
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/data.ts
  - kind: file
    ref: packages/vigla/src/runtime/dom/mount.ts
---
`mount` and `hydrate` root the tree under the owner current at the call, so an application's owner — a tab's — reaches the tree's context and destroys it with itself; called under no owner the root is top-level, as before. The root marks itself as a mount root, which is what `$props.id()` counts per mount by. Error transformation belongs to the mounted tree, so an enclosing application owner must not hide its transform from the tree's boundaries.

`openHydration({ format, target })` makes the current owner a reader of the page's published hydration data until the function it returns is called: `hydratable` under that owner answers from the server's values even when no `hydrate()` is running, which is what lets an application's start-up code and first loads see what the server registered before the tree hydrates. Inputs a mount opens for itself still answer only while hydrating. The opened owner is one more consumer of the published map, retained and released like a hydration root's, so closing the last consumer removes the map from the global. With no published data it opens nothing, so code reading `hydratable` in a page the server did not render is not made to fail.

`hydratable` keeps upstream's contract that a hydrating reader must find its key. `hydrated(key, fn)` is the optional read beside it: the server's value when the nearest open input holds the key, `fn()` otherwise, never failing. It exists for values a client may meet first — a framework's data cache read during start-up, where the server resolved some keys and not others; on the server it registers exactly as `hydratable` does, so one isomorphic call serves both sides.