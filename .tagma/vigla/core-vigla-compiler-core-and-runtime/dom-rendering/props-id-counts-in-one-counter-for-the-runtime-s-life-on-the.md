---
id: 01a187ae-6d0d-7d16-bd1e-acb4d5c2997d
title: "`$props.id()` counts in one counter for the runtime's life on the client and per `render()` call on the server"
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
  - kind: symbol
    ref: packages/vigla/src/compiler/client/index.ts
    symbol: client
  - kind: symbol
    ref: packages/vigla/src/compiler/server/index.ts
    symbol: server
---
An id from `$props.id()` goes into the DOM as an element's `id` and into the attributes that point at it — `for`, `aria-labelledby` — and applications also use it as a name of the instance, such as the asker of an async answer. Both need it distinct from every other id the document has issued, at once and later: two mounts standing in one document, a plugin's view beside the host's tree, must not both hold `c1`, and a mount made after another ended must not reuse the first one's names, or a late answer for the old instance reaches the new one. So the client counts in one counter for the runtime's whole life, as upstream's `window.__svelte.uid` does, and keeps it in the module rather than on `window`: the core puts no front end's name into a global. Two copies of the runtime in one document would count apart; a host serves its plugins one runtime for that reason.

The counter is a number, not a reference: it retains no tree, so invariant 5 of [[9d5e3831]] holds. It is still state a test run shares, so the Vigla target's hook restarts it before each sample, as upstream's runner resets its own, and the `props-id` samples keep reading `c1`, `c2`, … from their start.

On the server the counter is the `render()` call's. Both compilers take the id first thing in the component, before its script, and the declaration reads that value: the server writes `<!--$id-->` at the component's start and the hydrating client reads it there. An async script's continuation resumes with the cursor elsewhere, so an id taken where the script asks for it would be written outside the script's range and never found. A hydrated component thus keeps the server's `s<n>` (prefixed by `idPrefix`); a component created after hydration takes the next `c<n>`. The id text keeps upstream's shape.

The earlier design counted per mount, to keep nothing beyond a tree's life, and accepted that two mounts could both issue `c1`. Tagma's suite on Vigla showed what that costs: its dialogs, menus and fields take their DOM ids from `$props.id()` across several mounts of one document, and a diff reader names its highlight requests by it.
