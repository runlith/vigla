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
`mount` and `hydrate` root the tree under the owner current at the call, so an application's owner — a tab's — reaches the tree's context and destroys it with itself, through the same path as `unmount`: the root's destruction first releases its delegated listeners and removes its DOM, then aborts its lifetime and tears down its effects. A mount whose root ended during its own initialisation — a component disposing its enclosing owner — is neither inserted nor published, and a hydrated one has its claimed nodes removed; called under no owner the root is top-level, as before. The root marks itself as a mount root, which is what `$props.id()` counts per mount by. `unmount(instance, { outro: true })` pauses the root like a leaving branch: the transitions local to the mount (through the mount boundary, which is transparent, as upstream's is) play, the instance is forgotten at once so a second unmount warns, and the root is disposed and destroyed when they end, resolving the promise; destroying the root meanwhile, as its owner ending does, removes the DOM and resolves the promise at that point. A leaving effect keeps the disposal callback it had before, running it after its own on destruction and restoring it on reselection. An implicit pending boundary holds initial async content off-screen and supplies the mounted tree's `$effect.pending()` count; it handles no errors, so failures still escape to an enclosing handler, to the caller, or inside a flush to the tree's front end ([[4ece65b4]]). The root records its front end, the format given or the native one, which decides how its diagnostics print and its unhandled failures leave. Root hydration must reach its closing marker before that boundary settles its anchor: skipping unmatched server nodes would accept a malformed root and suppress recovery and failed-owner disposal. Explicit boundary arms keep their own replacement rules. This boundary belongs to DOM mounting, not to service roots. Error transformation belongs to the mounted tree, so an enclosing application owner must not hide its transform from the tree's boundaries.

`openHydration({ format, target })` makes the current owner a reader of the page's published hydration data until the function it returns is called: `hydratable` under that owner answers from the server's values even when no `hydrate()` is running, which is what lets an application's start-up code and first loads see what the server registered before the tree hydrates. Inputs a mount opens for itself still answer only while hydrating. The opened owner is one more consumer of the published map, retained and released like a hydration root's, so closing the last consumer removes the map from the global. With no published data it opens nothing, so code reading `hydratable` in a page the server did not render is not made to fail.

`hydratable` keeps upstream's contract that a hydrating reader must find its key. `hydrated(key, fn)` is the optional read beside it: the server's value when the nearest open input holds the key, `fn()` otherwise, never failing. It exists for values a client may meet first — a framework's data cache read during start-up, where the server resolved some keys and not others; on the server it registers exactly as `hydratable` does, so one isomorphic call serves both sides.